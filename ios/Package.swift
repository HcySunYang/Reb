// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Reb",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [
        .library(name: "Reb", targets: ["Reb"]),
    ],
    dependencies: [
        .package(url: "https://github.com/migueldeicaza/SwiftTerm", from: "1.13.0"),
    ],
    targets: [
        .target(
            name: "Reb",
            dependencies: ["SwiftTerm"],
            path: "Reb"
        ),
    ]
)
