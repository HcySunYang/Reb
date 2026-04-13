import SwiftUI

#if canImport(UIKit)
struct ConnectionView: View {
    @EnvironmentObject var wsService: WebSocketService
    @State private var profiles: [ConnectionProfile] = ConnectionStorage.loadProfiles()
    @State private var selectedProfileId: String? = ConnectionStorage.loadActiveProfileId()
    @State private var showAddSheet = false
    @State private var navigateToSessions = false

    var body: some View {
        VStack(spacing: 0) {
            // Status bar
            statusBar

            List {
                Section("Servers") {
                    ForEach(profiles) { profile in
                        serverRow(profile)
                    }
                    .onDelete(perform: deleteProfile)

                    Button {
                        showAddSheet = true
                    } label: {
                        Label("Add Server", systemImage: "plus")
                    }
                }
            }
        }
        .navigationTitle("Reb")
        .navigationDestination(isPresented: $navigateToSessions) {
            SessionListView()
        }
        .sheet(isPresented: $showAddSheet) {
            AddServerSheet(profiles: $profiles)
        }
        .onChange(of: wsService.state) { newValue in
            if newValue == .connected {
                navigateToSessions = true
            }
        }
    }

    // MARK: - Components

    private var statusBar: some View {
        HStack {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
            Text(wsService.state.label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
    }

    private var statusColor: Color {
        switch wsService.state {
        case .connected: return .green
        case .connecting, .authenticating: return .orange
        case .error: return .red
        case .disconnected: return .gray
        }
    }

    private func serverRow(_ profile: ConnectionProfile) -> some View {
        HStack {
            VStack(alignment: .leading) {
                Text(profile.name)
                    .font(.headline)
                Text("\(profile.host):\(profile.port)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Connect") {
                connectToProfile(profile)
            }
            .buttonStyle(.borderedProminent)
            .tint(.blue)
            .disabled(wsService.state == .connecting || wsService.state == .authenticating)
        }
    }

    // MARK: - Actions

    private func connectToProfile(_ profile: ConnectionProfile) {
        guard let url = profile.wsURL,
              let token = KeychainHelper.loadToken(for: profile.id) else {
            return
        }
        selectedProfileId = profile.id
        ConnectionStorage.saveActiveProfileId(profile.id)
        wsService.connect(url: url, token: token)
    }

    private func deleteProfile(at offsets: IndexSet) {
        for index in offsets {
            KeychainHelper.deleteToken(for: profiles[index].id)
        }
        profiles.remove(atOffsets: offsets)
        ConnectionStorage.saveProfiles(profiles)
    }
}

// MARK: - Add Server Sheet

struct AddServerSheet: View {
    @Binding var profiles: [ConnectionProfile]
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var host = ""
    @State private var port = "7680"
    @State private var token = ""
    @State private var useTLS = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Server") {
                    TextField("Name", text: $name)
                        .textContentType(.name)
                    TextField("Host (IP or hostname)", text: $host)
                        .textContentType(.URL)
                        .autocapitalization(.none)
                        .keyboardType(.URL)
                    TextField("Port", text: $port)
                        .keyboardType(.numberPad)
                    Toggle("Use TLS (wss://)", isOn: $useTLS)
                }

                Section("Authentication") {
                    SecureField("Auth Token", text: $token)
                }

                Section {
                    Text("Use `npm run generate-token` on your server to create a token, then enter it here.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Add Server")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(name.isEmpty || host.isEmpty || token.isEmpty)
                }
            }
        }
    }

    private func save() {
        let profile = ConnectionProfile(
            name: name,
            host: host,
            port: Int(port) ?? 7680,
            useTLS: useTLS
        )
        KeychainHelper.save(token: token, for: profile.id)
        profiles.append(profile)
        ConnectionStorage.saveProfiles(profiles)
        dismiss()
    }
}
#endif
