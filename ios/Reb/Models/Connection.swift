import Foundation
import Security

// MARK: - Connection Profile

struct ConnectionProfile: Codable, Identifiable {
    var id: String = UUID().uuidString
    var name: String
    var host: String
    var port: Int
    var useTLS: Bool

    var wsURL: URL? {
        let scheme = useTLS ? "wss" : "ws"
        return URL(string: "\(scheme)://\(host):\(port)")
    }
}

// MARK: - Connection Storage

class ConnectionStorage {
    private static let profilesKey = "reb_connection_profiles"
    private static let activeProfileKey = "reb_active_profile"

    static func saveProfiles(_ profiles: [ConnectionProfile]) {
        if let data = try? JSONEncoder().encode(profiles) {
            UserDefaults.standard.set(data, forKey: profilesKey)
        }
    }

    static func loadProfiles() -> [ConnectionProfile] {
        guard let data = UserDefaults.standard.data(forKey: profilesKey),
              let profiles = try? JSONDecoder().decode([ConnectionProfile].self, from: data) else {
            return []
        }
        return profiles
    }

    static func saveActiveProfileId(_ id: String) {
        UserDefaults.standard.set(id, forKey: activeProfileKey)
    }

    static func loadActiveProfileId() -> String? {
        UserDefaults.standard.string(forKey: activeProfileKey)
    }
}

// MARK: - Keychain Helper

class KeychainHelper {
    static func save(token: String, for profileId: String) {
        let data = Data(token.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "reb_token_\(profileId)",
            kSecValueData as String: data,
        ]
        SecItemDelete(query as CFDictionary) // Remove old value
        SecItemAdd(query as CFDictionary, nil)
    }

    static func loadToken(for profileId: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "reb_token_\(profileId)",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func deleteToken(for profileId: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "reb_token_\(profileId)",
        ]
        SecItemDelete(query as CFDictionary)
    }
}
