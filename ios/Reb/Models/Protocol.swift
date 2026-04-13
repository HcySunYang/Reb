import Foundation

// MARK: - Protocol Message Types (mirrors server/src/protocol.ts)

enum MessageType: String, Codable {
    case auth
    case authResult = "auth_result"
    case createSession = "create_session"
    case sessionCreated = "session_created"
    case resize
    case listSessions = "list_sessions"
    case sessionList = "session_list"
    case killSession = "kill_session"
    case sessionEnded = "session_ended"
    case error
    case output
    case input
}

// MARK: - Client → Server

struct AuthMessage: Codable {
    let type = "auth"
    let token: String
}

struct CreateSessionMessage: Codable {
    let type = "create_session"
    let cols: Int
    let rows: Int
    var command: String?
}

struct ResizeMessage: Codable {
    let type = "resize"
    let sessionId: String
    let cols: Int
    let rows: Int
}

struct ListSessionsMessage: Codable {
    let type = "list_sessions"
}

struct KillSessionMessage: Codable {
    let type = "kill_session"
    let sessionId: String
}

// MARK: - Server → Client

struct AuthResultPayload: Codable {
    let type: String
    let success: Bool
    let error: String?
}

struct SessionCreatedPayload: Codable {
    let type: String
    let sessionId: String
}

struct SessionInfo: Codable, Identifiable {
    let id: String
    let pid: Int
    let createdAt: String
    let command: String
}

struct SessionListPayload: Codable {
    let type: String
    let sessions: [SessionInfo]
}

struct SessionEndedPayload: Codable {
    let type: String
    let sessionId: String
    let exitCode: Int
}

struct ErrorPayload: Codable {
    let type: String
    let message: String
    let context: String?
}

// MARK: - Generic envelope for routing

struct MessageEnvelope: Codable {
    let type: String
}

// MARK: - Binary Frame Constants

let binaryInputTag: UInt8 = 0x01
let binaryOutputTag: UInt8 = 0x02

func uuidToBytes(_ uuid: String) -> Data {
    let hex = uuid.replacingOccurrences(of: "-", with: "")
    var data = Data()
    var index = hex.startIndex
    for _ in 0..<16 {
        let nextIndex = hex.index(index, offsetBy: 2)
        if let byte = UInt8(hex[index..<nextIndex], radix: 16) {
            data.append(byte)
        }
        index = nextIndex
    }
    return data
}

func bytesToUuid(_ data: Data, offset: Int = 0) -> String {
    let hex = data[offset..<(offset + 16)].map { String(format: "%02x", $0) }.joined()
    let parts = [
        String(hex.prefix(8)),
        String(hex.dropFirst(8).prefix(4)),
        String(hex.dropFirst(12).prefix(4)),
        String(hex.dropFirst(16).prefix(4)),
        String(hex.dropFirst(20)),
    ]
    return parts.joined(separator: "-")
}

func buildInputFrame(sessionId: String, data: Data) -> Data {
    var frame = Data([binaryInputTag])
    frame.append(uuidToBytes(sessionId))
    frame.append(data)
    return frame
}

func parseOutputFrame(_ frame: Data) -> (sessionId: String, data: Data)? {
    guard frame.count >= 17, frame[0] == binaryOutputTag else { return nil }
    let sessionId = bytesToUuid(frame, offset: 1)
    let data = frame.subdata(in: 17..<frame.count)
    return (sessionId, data)
}
