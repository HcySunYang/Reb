import SwiftUI

#if canImport(UIKit)
struct SessionListView: View {
    @EnvironmentObject var wsService: WebSocketService
    @State private var navigateToTerminal: String? = nil
    @State private var isCreating = false

    private var isNavigating: Binding<Bool> {
        Binding(
            get: { navigateToTerminal != nil },
            set: { if !$0 { navigateToTerminal = nil } }
        )
    }

    var body: some View {
        List {
            Section {
                Button {
                    createNewSession()
                } label: {
                    Label("New Claude Session", systemImage: "terminal")
                }
                .disabled(isCreating)
            }

            Section("Active Sessions") {
                if wsService.sessions.isEmpty {
                    Text("No active sessions")
                        .foregroundStyle(.secondary)
                        .italic()
                } else {
                    ForEach(wsService.sessions) { session in
                        sessionRow(session)
                    }
                }
            }
        }
        .navigationTitle("Sessions")
        .navigationDestination(isPresented: isNavigating) {
            if let sessionId = navigateToTerminal {
                TerminalContainerView(sessionId: sessionId)
            }
        }
        .refreshable {
            wsService.listSessions()
        }
        .onAppear {
            wsService.listSessions()
            wsService.onSessionCreated = { sessionId in
                isCreating = false
                navigateToTerminal = sessionId
            }
        }
    }

    private func sessionRow(_ session: SessionInfo) -> some View {
        Button {
            navigateToTerminal = session.id
        } label: {
            HStack {
                VStack(alignment: .leading) {
                    Text(session.command)
                        .font(.headline)
                    Text("PID: \(session.pid)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(formatDate(session.createdAt))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(.secondary)
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) {
                wsService.killSession(sessionId: session.id)
            } label: {
                Label("Kill", systemImage: "xmark.circle")
            }
        }
    }

    private func createNewSession() {
        isCreating = true
        // Default terminal size; will be resized when terminal view appears
        wsService.createSession(cols: 80, rows: 24)
    }

    private func formatDate(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: iso) else {
            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: iso) else { return iso }
            return RelativeDateTimeFormatter().localizedString(for: date, relativeTo: Date())
        }
        return RelativeDateTimeFormatter().localizedString(for: date, relativeTo: Date())
    }
}

// Make String work with navigationDestination(item:)
extension String: @retroactive Identifiable {
    public var id: String { self }
}
#endif
