var places = require('places/places.js')
var urlParser = require('util/urlParser.js')
var webviews = require('webviews.js')
var tabEditor = require('navbar/tabEditor.js')
var browserUI = require('browserUI.js')

const bookmarkBar = {
  container: null,
  itemsEl: null,
  initialize: function () {
    bookmarkBar.container = document.getElementById('bookmark-bar')
    bookmarkBar.itemsEl = document.getElementById('bookmark-bar-items')
    if (!bookmarkBar.container || !bookmarkBar.itemsEl) {
      return
    }
    bookmarkBar.refresh()
  },
  refresh: async function () {
    if (!bookmarkBar.itemsEl) {
      return
    }
    empty(bookmarkBar.itemsEl)

    const results = await places.searchPlaces('', {
      searchBookmarks: true,
      limit: Infinity
    })

    results.sort(function (a, b) {
      const titleA = (a.title || urlParser.basicURL(urlParser.getSourceURL(a.url))).toLowerCase()
      const titleB = (b.title || urlParser.basicURL(urlParser.getSourceURL(b.url))).toLowerCase()
      return titleA.localeCompare(titleB)
    })

    results.forEach(function (result) {
      const el = document.createElement('a')
      el.className = 'bookmark-bar-item'
      el.href = '#'
      el.title = result.url
      el.textContent = result.title || urlParser.basicURL(urlParser.getSourceURL(result.url))
      el.addEventListener('click', function (e) {
        e.preventDefault()
        if (e.ctrlKey || e.metaKey) {
          browserUI.addTab(tabs.add({ url: result.url }), {
            enterEditMode: false,
            openInBackground: true
          })
        } else {
          webviews.update(tabs.getSelected(), result.url)
          tabEditor.updateDisplay(tabs.getSelected())
        }
      })
      el.addEventListener('contextmenu', function (e) {
        e.preventDefault()
        places.deleteHistory(result.url)
        bookmarkBar.refresh()
        tabEditor.updateDisplay(tabs.getSelected())
      })
      bookmarkBar.itemsEl.appendChild(el)
    })

    const allBtn = document.createElement('button')
    allBtn.className = 'bookmark-bar-all'
    allBtn.textContent = l('searchBookmarks') || '所有书签'
    allBtn.addEventListener('click', function () {
      tabEditor.show(tabs.getSelected(), '!bookmarks ')
    })
    bookmarkBar.itemsEl.appendChild(allBtn)
  }
}

module.exports = bookmarkBar
