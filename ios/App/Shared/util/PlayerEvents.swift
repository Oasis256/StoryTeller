//
//  PlayerEvents.swift
//  App
//
//  Created by Rasmus Krämer on 14.04.22.
//

import Foundation

enum PlayerEvents: String {
    case update = "com.buks.app.player.update"
    case closed = "com.buks.app.player.closed"
    case sleepSet = "com.buks.app.player.sleep.set"
    case sleepEnded = "com.buks.app.player.sleep.ended"
    case failed = "com.buks.app.player.failed"
    case localProgress = "com.buks.app.player.localProgress"
}
