import SwiftUI
#if canImport(UIKit)
import SwiftTerm

// MARK: - Terminal Container (manages lifecycle)

struct TerminalContainerView: View {
    let sessionId: String
    @EnvironmentObject var wsService: WebSocketService
    @State private var sessionEnded = false
    @State private var exitCode: Int?

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if sessionEnded {
                VStack {
                    Image(systemName: "terminal")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("Session ended (exit code: \(exitCode ?? -1))")
                        .foregroundStyle(.secondary)
                }
            } else {
                SwiftTermView(sessionId: sessionId, wsService: wsService)
                    .ignoresSafeArea(.keyboard)
            }
        }
        .navigationTitle("Terminal")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onAppear {
            wsService.onSessionEnded = { endedId, code in
                if endedId == sessionId {
                    sessionEnded = true
                    exitCode = code
                }
            }
        }
    }
}

// MARK: - SwiftTerm UIViewRepresentable

struct SwiftTermView: UIViewRepresentable {
    let sessionId: String
    let wsService: WebSocketService

    func makeUIView(context: Context) -> UIView {
        let container = UIView()
        container.backgroundColor = .black

        let termView = TerminalView(frame: .zero)
        termView.translatesAutoresizingMaskIntoConstraints = false
        termView.terminalDelegate = context.coordinator
        termView.nativeBackgroundColor = .black
        termView.nativeForegroundColor = .white

        // Configure terminal font
        let fontSize: CGFloat = UIDevice.current.userInterfaceIdiom == .pad ? 14 : 12
        termView.font = UIFont.monospacedSystemFont(ofSize: fontSize, weight: .regular)

        container.addSubview(termView)
        NSLayoutConstraint.activate([
            termView.topAnchor.constraint(equalTo: container.topAnchor),
            termView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            termView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            termView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
        ])

        context.coordinator.terminalView = termView
        context.coordinator.setupOutputHandler()

        // Become first responder to show keyboard
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            _ = termView.becomeFirstResponder()
        }

        return container
    }

    func updateUIView(_ uiView: UIView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(sessionId: sessionId, wsService: wsService)
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, TerminalViewDelegate {
        let sessionId: String
        let wsService: WebSocketService
        weak var terminalView: TerminalView?
        private var lastCols: Int = 0
        private var lastRows: Int = 0

        init(sessionId: String, wsService: WebSocketService) {
            self.sessionId = sessionId
            self.wsService = wsService
        }

        func setupOutputHandler() {
            wsService.onOutput = { [weak self] outputSessionId, data in
                guard let self = self,
                      outputSessionId == self.sessionId,
                      let termView = self.terminalView else { return }
                let bytes: [UInt8] = Array(data)
                termView.feed(byteArray: ArraySlice(bytes))
            }
        }

        // MARK: - TerminalViewDelegate

        func sizeChanged(source: TerminalView, newCols: Int, newRows: Int) {
            guard newCols != lastCols || newRows != lastRows else { return }
            lastCols = newCols
            lastRows = newRows
            wsService.resizeSession(sessionId: sessionId, cols: newCols, rows: newRows)
        }

        func send(source: TerminalView, data: ArraySlice<UInt8>) {
            let bytes = Data(data)
            wsService.sendInput(sessionId: sessionId, data: bytes)
        }

        func scrolled(source: TerminalView, position: Double) {}
        func setTerminalTitle(source: TerminalView, title: String) {}
        func setTerminalIconTitle(source: TerminalView, title: String) {}
        func hostCurrentDirectoryUpdate(source: TerminalView, directory: String?) {}
        func clipboardCopy(source: TerminalView, content: Data) {
            if let str = String(data: content, encoding: .utf8) {
                UIPasteboard.general.string = str
            }
        }
        func requestOpenLink(source: TerminalView, link: String, params: [String: String]) {
            if let url = URL(string: link) {
                UIApplication.shared.open(url)
            }
        }
        func rangeChanged(source: TerminalView, startY: Int, endY: Int) {}
    }
}

// MARK: - Special Keys Toolbar

struct TerminalToolbar: View {
    let onKey: (String) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                toolbarButton("Esc", key: "\u{1b}")
                toolbarButton("Tab", key: "\t")
                toolbarButton("Ctrl", key: "") // Modifier, handled differently
                Divider().frame(height: 24)
                toolbarButton("↑", key: "\u{1b}[A")
                toolbarButton("↓", key: "\u{1b}[B")
                toolbarButton("←", key: "\u{1b}[D")
                toolbarButton("→", key: "\u{1b}[C")
                Divider().frame(height: 24)
                toolbarButton("Ctrl+C", key: "\u{03}")
                toolbarButton("Ctrl+D", key: "\u{04}")
                toolbarButton("Ctrl+Z", key: "\u{1a}")
                toolbarButton("Ctrl+L", key: "\u{0c}")
            }
            .padding(.horizontal)
        }
        .frame(height: 44)
        .background(.ultraThinMaterial)
    }

    private func toolbarButton(_ label: String, key: String) -> some View {
        Button(label) {
            if !key.isEmpty {
                onKey(key)
            }
        }
        .font(.system(size: 13, weight: .medium, design: .monospaced))
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color(.systemGray5))
        .cornerRadius(6)
    }
}

#endif // canImport(UIKit)
