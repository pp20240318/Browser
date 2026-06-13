var places = require('places/places.js')
var urlParser = require('util/urlParser.js')
var webviews = require('webviews.js')
var tabEditor = require('navbar/tabEditor.js')
var browserUI = require('browserUI.js')
var bookmarkUtils = require('bookmarkUtils.js')
var bookmarkDialog = require('bookmarkDialog.js')
const remoteMenu = require('remoteMenuRenderer.js')

const bookmarkBar = {
  container: null,
  itemsEl: null,
  overflowEl: null,
  renderedItems: [],
  refreshGeneration: 0,

  initialize: function () {
    bookmarkBar.container = document.getElementById('bookmark-bar')
    bookmarkBar.itemsEl = document.getElementById('bookmark-bar-items')
    if (!bookmarkBar.container || !bookmarkBar.itemsEl) {
      return
    }
    bookmarkBar.refresh()
    window.addEventListener('resize', throttle(function () {
      bookmarkBar.updateOverflow()
    }, 100))
  },

  openUrl: function (url, e) {
    if (e && (e.ctrlKey || e.metaKey || e.button === 1)) {
      browserUI.addTab(tabs.add({ url: url }), {
        enterEditMode: false,
        openInBackground: true
      })
    } else {
      webviews.update(tabs.getSelected(), url)
      tabEditor.updateDisplay(tabs.getSelected())
    }
  },

  showContextMenu: function (bookmark, x, y) {
    remoteMenu.open([
      [
        {
          label: l('openBookmark'),
          click: function () {
            bookmarkBar.openUrl(bookmark.url)
          }
        },
        {
          label: l('openBookmarkNewTab'),
          click: function () {
            browserUI.addTab(tabs.add({ url: bookmark.url }), {
              enterEditMode: false,
              openInBackground: false
            })
          }
        }
      ],
      [
        {
          label: l('editBookmark'),
          click: function () {
            bookmarkDialog.show(bookmark.url, {
              onClose: function () {
                tabEditor.updateDisplay(tabs.getSelected())
              }
            })
          }
        },
        {
          label: l('removeFromBar'),
          click: async function () {
            const item = await places.getItem(bookmark.url)
            if (!item) return
            const tags = item.tags.filter(function (tag) {
              return !bookmarkUtils.isBarTag(tag) && !bookmarkUtils.isBarFolderTag(tag)
            })
            if (tags.length === 0) {
              tags.push(bookmarkUtils.OTHER_TAG)
            }
            await places.updateItem(bookmark.url, { tags: tags })
            bookmarkBar.refresh()
          }
        },
        {
          label: l('deleteBookmark'),
          click: function () {
            places.deleteHistory(bookmark.url)
            bookmarkBar.refresh()
            tabEditor.updateDisplay(tabs.getSelected())
          }
        }
      ]
    ], x, y)
  },

  createBookmarkElement: function (bookmark) {
    const el = document.createElement('a')
    el.className = 'bookmark-bar-item'
    el.href = '#'
    el.title = bookmark.url
    el.textContent = bookmarkUtils.getBookmarkTitle(bookmark)
    el.setAttribute('data-url', bookmark.url)

    el.addEventListener('click', function (e) {
      e.preventDefault()
      bookmarkBar.openUrl(bookmark.url, e)
    })

    el.addEventListener('contextmenu', function (e) {
      e.preventDefault()
      bookmarkBar.showContextMenu(bookmark, e.clientX, e.clientY)
    })

    return el
  },

  createFolderElement: function (folderTag, bookmarks) {
    const wrapper = document.createElement('div')
    wrapper.className = 'bookmark-bar-folder'

    const btn = document.createElement('button')
    btn.className = 'bookmark-bar-item bookmark-bar-folder-button'
    btn.textContent = bookmarkUtils.getFolderDisplayName(folderTag)
    btn.title = bookmarkUtils.getFolderDisplayName(folderTag)

    const menu = document.createElement('div')
    menu.className = 'bookmark-bar-folder-menu'
    menu.hidden = true

    bookmarks.forEach(function (bookmark) {
      const item = document.createElement('a')
      item.className = 'bookmark-bar-folder-item'
      item.href = '#'
      item.textContent = bookmarkUtils.getBookmarkTitle(bookmark)
      item.title = bookmark.url
      item.addEventListener('click', function (e) {
        e.preventDefault()
        menu.hidden = true
        wrapper.classList.remove('open')
        bookmarkBar.openUrl(bookmark.url, e)
      })
      item.addEventListener('contextmenu', function (e) {
        e.preventDefault()
        menu.hidden = true
        wrapper.classList.remove('open')
        bookmarkBar.showContextMenu(bookmark, e.clientX, e.clientY)
      })
      menu.appendChild(item)
    })

    btn.addEventListener('click', function (e) {
      e.stopPropagation()
      const isOpen = !menu.hidden
      bookmarkBar.closeAllFolderMenus()
      if (!isOpen) {
        menu.hidden = false
        wrapper.classList.add('open')
      }
    })

    wrapper.appendChild(btn)
    wrapper.appendChild(menu)
    return wrapper
  },

  closeAllFolderMenus: function () {
    bookmarkBar.itemsEl.querySelectorAll('.bookmark-bar-folder.open').forEach(function (el) {
      el.classList.remove('open')
      el.querySelector('.bookmark-bar-folder-menu').hidden = true
    })
    if (bookmarkBar.overflowEl) {
      bookmarkBar.overflowEl.querySelectorAll('.bookmark-bar-folder.open').forEach(function (el) {
        el.classList.remove('open')
        el.querySelector('.bookmark-bar-folder-menu').hidden = true
      })
    }
  },

  updateOverflow: function () {
    if (!bookmarkBar.itemsEl || !bookmarkBar.renderedItems.length) {
      return
    }

    bookmarkBar.renderedItems.forEach(function (el) {
      el.classList.remove('overflow-hidden')
      el.hidden = false
    })
    if (bookmarkBar.overflowEl) {
      bookmarkBar.overflowEl.hidden = true
      empty(bookmarkBar.overflowEl)
    }

    const barWidth = bookmarkBar.itemsEl.clientWidth
    const allBtn = bookmarkBar.itemsEl.querySelector('.bookmark-bar-all')
    const allBtnWidth = allBtn ? allBtn.offsetWidth + 4 : 0
    const overflowBtnWidth = 32
    let available = barWidth - allBtnWidth - overflowBtnWidth

    const items = bookmarkBar.renderedItems.filter(function (el) {
      return !el.classList.contains('bookmark-bar-all')
    })

    let needsOverflow = false
    items.forEach(function (el) {
      available -= el.offsetWidth + 2
      if (available < 0) {
        needsOverflow = true
        el.classList.add('overflow-hidden')
        el.hidden = true
      }
    })

    if (!needsOverflow) {
      return
    }

    if (!bookmarkBar.overflowEl) {
      bookmarkBar.overflowEl = document.createElement('div')
      bookmarkBar.overflowEl.className = 'bookmark-bar-overflow'
      const overflowBtn = document.createElement('button')
      overflowBtn.className = 'bookmark-bar-overflow-button i carbon:overflow-menu-horizontal'
      overflowBtn.title = l('moreBookmarks')
      overflowBtn.addEventListener('click', function (e) {
        e.stopPropagation()
        const menu = bookmarkBar.overflowEl.querySelector('.bookmark-bar-overflow-menu')
        const isOpen = !menu.hidden
        bookmarkBar.closeAllFolderMenus()
        if (isOpen) {
          menu.hidden = true
          bookmarkBar.overflowEl.classList.remove('open')
        } else {
          menu.hidden = false
          bookmarkBar.overflowEl.classList.add('open')
        }
      })
      const overflowMenu = document.createElement('div')
      overflowMenu.className = 'bookmark-bar-overflow-menu'
      overflowMenu.hidden = true
      bookmarkBar.overflowEl.appendChild(overflowBtn)
      bookmarkBar.overflowEl.appendChild(overflowMenu)
      bookmarkBar.itemsEl.insertBefore(bookmarkBar.overflowEl, allBtn)
    }

    const overflowMenu = bookmarkBar.overflowEl.querySelector('.bookmark-bar-overflow-menu')
    empty(overflowMenu)

    items.forEach(function (el) {
      if (!el.classList.contains('overflow-hidden')) {
        return
      }
      const url = el.getAttribute('data-url')
      if (url) {
        const bookmark = bookmarkBar.barBookmarks.find(function (b) { return b.url === url })
        if (bookmark) {
          const item = document.createElement('a')
          item.className = 'bookmark-bar-folder-item'
          item.href = '#'
          item.textContent = bookmarkUtils.getBookmarkTitle(bookmark)
          item.addEventListener('click', function (e) {
            e.preventDefault()
            bookmarkBar.overflowEl.classList.remove('open')
            overflowMenu.hidden = true
            bookmarkBar.openUrl(bookmark.url, e)
          })
          overflowMenu.appendChild(item)
        }
      } else if (el.classList.contains('bookmark-bar-folder')) {
        overflowMenu.appendChild(el.cloneNode(true))
      }
    })

    bookmarkBar.overflowEl.hidden = false
  },

  refresh: async function () {
    if (!bookmarkBar.itemsEl) {
      return
    }

    const generation = ++bookmarkBar.refreshGeneration

    const results = await places.searchPlaces('', {
      searchBookmarks: true,
      limit: Infinity
    })

    if (generation !== bookmarkBar.refreshGeneration) {
      return
    }

    empty(bookmarkBar.itemsEl)
    bookmarkBar.renderedItems = []
    bookmarkBar.overflowEl = null
    bookmarkBar.barBookmarks = []

    const seenUrls = new Set()
    const barBookmarks = results.filter(function (result) {
      if (!bookmarkUtils.isOnBar(result)) {
        return false
      }
      const normalizedUrl = bookmarkUtils.normalizeBookmarkUrl(result.url)
      if (seenUrls.has(normalizedUrl)) {
        return false
      }
      seenUrls.add(normalizedUrl)
      return true
    })
    bookmarkBar.barBookmarks = barBookmarks

    const folderMap = {}
    const directItems = []

    barBookmarks.forEach(function (bookmark) {
      const folderTag = bookmarkUtils.getBarFolderTag(bookmark)
      if (folderTag) {
        if (!folderMap[folderTag]) {
          folderMap[folderTag] = []
        }
        folderMap[folderTag].push(bookmark)
      } else {
        directItems.push(bookmark)
      }
    })

    directItems.sort(bookmarkUtils.sortByTitle)

    directItems.forEach(function (bookmark) {
      const el = bookmarkBar.createBookmarkElement(bookmark)
      bookmarkBar.itemsEl.appendChild(el)
      bookmarkBar.renderedItems.push(el)
    })

    Object.keys(folderMap).sort().forEach(function (folderTag) {
      const bookmarks = folderMap[folderTag].sort(bookmarkUtils.sortByTitle)
      const el = bookmarkBar.createFolderElement(folderTag, bookmarks)
      bookmarkBar.itemsEl.appendChild(el)
      bookmarkBar.renderedItems.push(el)
    })

    const allBtn = document.createElement('button')
    allBtn.className = 'bookmark-bar-all'
    allBtn.textContent = l('allBookmarks') || l('searchBookmarks')
    allBtn.addEventListener('click', function () {
      tabEditor.show(tabs.getSelected(), '!bookmarks ')
    })
    bookmarkBar.itemsEl.appendChild(allBtn)
    bookmarkBar.renderedItems.push(allBtn)

    requestAnimationFrame(function () {
      if (generation === bookmarkBar.refreshGeneration) {
        bookmarkBar.updateOverflow()
      }
    })
  }
}

document.addEventListener('click', function () {
  bookmarkBar.closeAllFolderMenus()
  if (bookmarkBar.overflowEl) {
    bookmarkBar.overflowEl.classList.remove('open')
    const menu = bookmarkBar.overflowEl.querySelector('.bookmark-bar-overflow-menu')
    if (menu) menu.hidden = true
  }
})

module.exports = bookmarkBar
