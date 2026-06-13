var bossKeyActive = false

function applyBossKeyToWindow (win) {
  if (bossKeyActive) {
    win.setSkipTaskbar(true)
    win.hide()
  }
}

function toggleBossKey () {
  if (bossKeyActive) {
    bossKeyActive = false
    windows.getAll().forEach(function (win) {
      win.setSkipTaskbar(false)
      win.show()
    })
    const current = windows.getCurrent()
    if (current) {
      current.focus()
    }
  } else {
    bossKeyActive = true
    windows.getAll().forEach(function (win) {
      win.setSkipTaskbar(true)
      win.hide()
    })
  }
}

function initBossKey () {
  const { globalShortcut } = electron
  const accelerators = ['Alt+`', 'Alt+Backquote']

  let registered = false
  for (let i = 0; i < accelerators.length; i++) {
    if (globalShortcut.register(accelerators[i], toggleBossKey)) {
      registered = true
      break
    }
  }

  if (!registered) {
    console.warn('Boss key shortcut registration failed')
  }

  app.on('will-quit', function () {
    globalShortcut.unregisterAll()
  })
}
