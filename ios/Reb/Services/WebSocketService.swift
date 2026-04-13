import Foundation
import Combine

// MARK: - Connection State

enum ConnectionState: Equatable {
    case disconnected
    case connecting
    case authenticating
    case connected
    case error(String)

    var label: String {
        switch self {
        case .disconnected: return "Disconnected"
        case .connecting: return "Connecting..."
        case .authenticating: return "Authenticating..."
        case .connected: return "Connected"
        case .error(let msg): return "Error: \(msg)"
        }
    }
}

// MARK: - WebSocket Service

class WebSocketService: ObservableObject {
    @Published var state: ConnectionState = .disconnected
    @Published var sessions: [SessionInfo] = []

    private var webSocketTask: URLSessionWebSocketTask?
    private var session: URLSession?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 5
    private var pendingToken: String?
    private var serverURL: URL?

    // Callbacks
    var onOutput: ((String, Data) -> Void)?  // sessionId, data
    var onSessionEnded: ((String, Int) -> Void)?  // sessionId, exitCode
    var onSessionCreated: ((String) -> Void)?  // sessionId

    func connect(url: URL, token: String) {
        disconnect()

        serverURL = url
        pendingToken = token
        state = .connecting
        reconnectAttempts = 0

        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        session = URLSession(configuration: config)
        webSocketTask = session?.webSocketTask(with: url)
        webSocketTask?.resume()

        listenForMessages()
        authenticate(token: token)
    }

    func disconnect() {
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        session?.invalidateAndCancel()
        session = nil
        state = .disconnected
        sessions = []
    }

    // MARK: - Send Messages

    func createSession(cols: Int, rows: Int) {
        let msg = CreateSessionMessage(cols: cols, rows: rows)
        sendJSON(msg)
    }

    func sendInput(sessionId: String, data: Data) {
        let frame = buildInputFrame(sessionId: sessionId, data: data)
        webSocketTask?.send(.data(frame)) { [weak self] error in
            if let error = error {
                self?.handleError(error)
            }
        }
    }

    func sendInput(sessionId: String, text: String) {
        guard let data = text.data(using: .utf8) else { return }
        sendInput(sessionId: sessionId, data: data)
    }

    func resizeSession(sessionId: String, cols: Int, rows: Int) {
        let msg = ResizeMessage(sessionId: sessionId, cols: cols, rows: rows)
        sendJSON(msg)
    }

    func listSessions() {
        sendJSON(ListSessionsMessage())
    }

    func killSession(sessionId: String) {
        let msg = KillSessionMessage(sessionId: sessionId)
        sendJSON(msg)
    }

    // MARK: - Private

    private func authenticate(token: String) {
        state = .authenticating
        let msg = AuthMessage(token: token)
        sendJSON(msg)
    }

    private func sendJSON<T: Encodable>(_ message: T) {
        guard let data = try? JSONEncoder().encode(message),
              let str = String(data: data, encoding: .utf8) else { return }
        webSocketTask?.send(.string(str)) { [weak self] error in
            if let error = error {
                self?.handleError(error)
            }
        }
    }

    private func listenForMessages() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let message):
                self.handleMessage(message)
                self.listenForMessages() // Continue listening
            case .failure(let error):
                self.handleError(error)
            }
        }
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let text):
            handleTextMessage(text)
        case .data(let data):
            handleBinaryMessage(data)
        @unknown default:
            break
        }
    }

    private func handleTextMessage(_ text: String) {
        guard let data = text.data(using: .utf8) else { return }

        // Parse the type first
        guard let envelope = try? JSONDecoder().decode(MessageEnvelope.self, from: data) else { return }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            switch envelope.type {
            case "auth_result":
                if let payload = try? JSONDecoder().decode(AuthResultPayload.self, from: data) {
                    if payload.success {
                        self.state = .connected
                        self.reconnectAttempts = 0
                        self.listSessions()
                    } else {
                        self.state = .error(payload.error ?? "Authentication failed")
                    }
                }

            case "session_created":
                if let payload = try? JSONDecoder().decode(SessionCreatedPayload.self, from: data) {
                    self.onSessionCreated?(payload.sessionId)
                    self.listSessions()
                }

            case "session_list":
                if let payload = try? JSONDecoder().decode(SessionListPayload.self, from: data) {
                    self.sessions = payload.sessions
                }

            case "session_ended":
                if let payload = try? JSONDecoder().decode(SessionEndedPayload.self, from: data) {
                    self.sessions.removeAll { $0.id == payload.sessionId }
                    self.onSessionEnded?(payload.sessionId, payload.exitCode)
                }

            case "error":
                if let payload = try? JSONDecoder().decode(ErrorPayload.self, from: data) {
                    print("[Reb] Server error: \(payload.message)")
                }

            default:
                break
            }
        }
    }

    private func handleBinaryMessage(_ data: Data) {
        guard let output = parseOutputFrame(data) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.onOutput?(output.sessionId, output.data)
        }
    }

    private func handleError(_ error: Error) {
        print("[Reb] WebSocket error: \(error.localizedDescription)")
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.state = .error(error.localizedDescription)
            self.attemptReconnect()
        }
    }

    private func attemptReconnect() {
        guard reconnectAttempts < maxReconnectAttempts,
              let url = serverURL,
              let token = pendingToken else {
            return
        }

        reconnectAttempts += 1
        let delay = pow(2.0, Double(reconnectAttempts)) // Exponential backoff
        print("[Reb] Reconnecting in \(delay)s (attempt \(reconnectAttempts)/\(maxReconnectAttempts))")

        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            self?.connect(url: url, token: token)
        }
    }
}
