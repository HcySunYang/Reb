import SwiftUI

#if canImport(UIKit)
@main
struct RebApp: App {
    @StateObject private var wsService = WebSocketService()

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                ConnectionView()
            }
            .environmentObject(wsService)
            .preferredColorScheme(.dark)
        }
    }
}
#endif
