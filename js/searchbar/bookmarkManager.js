var searchbar = require('searchbar/searchbar.js')
var searchbarPlugins = require('searchbar/searchbarPlugins.js')
var searchbarUtils = require('searchbar/searchbarUtils.js')
var bangsPlugin = require('searchbar/bangsPlugin.js')
var places = require('places/places.js')
var urlParser = require('util/urlParser.js')
var bookmarkUtils = require('bookmarkUtils.js')

var tabEditor = require('navbar/tabEditor.js')
var bookmarkEditor = require('searchbar/bookmarkEditor.js')
var bookmarkDialog = require('bookmarkDialog.js')

const maxTagSuggestions = 12

function parseBookmarkSearch (text) {
  var tags = text.split(/\s/g).filter(function (word) {
    return word.startsWith('#') && word.length > 1
  }).map(t => t.substring(1))

  var newText = text
  tags.forEach(function (word) {
    newText = newText.replace('#' + word, '')
  })
  newText = newText.trim()
  return {
    tags,
    text: newText
  }
}

function itemMatchesTags (item, tags) {
  for (var i = 0; i < tags.length; i++) {
    if (!item.tags.filter(t => t.startsWith(tags[i])).length) {
      return false
    }
  }
  return true
}

function showBookmarkEditor (url, item) {
  bookmarkDialog.show(url, {
    onClose: function (newBookmark) {
      if (newBookmark === false) {
        return
      }
      if (tabEditor.input && tabEditor.input.value.startsWith('!bookmarks')) {
        searchbar.showResults(tabEditor.input.value, null)
      } else if (!newBookmark && item && item.parentNode) {
        item.remove()
      }
    }
  })
}

function getBookmarkListItemData (result, focus) {
  const folder = bookmarkUtils.getPrimaryFolder(result.tags)
  return {
    title: bookmarkUtils.getBookmarkTitle(result),
    metadata: [bookmarkUtils.getFolderDisplayName(folder)],
    secondaryText: urlParser.basicURL(urlParser.getSourceURL(result.url)),
    fakeFocus: focus,
    click: function (e) {
      searchbar.openURL(result.url, e)
    },
    classList: ['bookmark-item'],
    delete: function () {
      places.deleteHistory(result.url)
      try {
        require('navbar/bookmarkBar.js').refresh()
      } catch (e) {}
    },
    button: {
      icon: 'carbon:edit',
      fn: function (el) {
        showBookmarkEditor(result.url, el.parentNode)
      }
    }
  }
}

function groupByFolder (results) {
  const groups = {}
  const seenUrls = new Set()
  results.forEach(function (result) {
    const normalizedUrl = bookmarkUtils.normalizeBookmarkUrl(result.url)
    if (seenUrls.has(normalizedUrl)) {
      return
    }
    seenUrls.add(normalizedUrl)
    const folder = bookmarkUtils.getPrimaryFolder(result.tags)
    if (!groups[folder]) {
      groups[folder] = []
    }
    groups[folder].push(result)
  })

  const folderOrder = Object.keys(groups).sort(function (a, b) {
    if (a === bookmarkUtils.BAR_TAG) return -1
    if (b === bookmarkUtils.BAR_TAG) return 1
    if (a === bookmarkUtils.OTHER_TAG) return 1
    if (b === bookmarkUtils.OTHER_TAG) return -1
    return bookmarkUtils.getFolderDisplayName(a).localeCompare(bookmarkUtils.getFolderDisplayName(b))
  })

  return folderOrder.map(function (folder) {
    return {
      folder: folder,
      items: groups[folder].sort(bookmarkUtils.sortByTitle)
    }
  })
}

const bookmarkManager = {
  showBookmarks: async function (text, input, event) {
    var container = searchbarPlugins.getContainer('bangs')

    var lazyList = searchbarUtils.createLazyList(container.parentNode)

    var parsedText = parseBookmarkSearch(text)

    var displayedURLset = []

    const results = await places.searchPlaces(parsedText.text, {
      searchBookmarks: true,
      limit: Infinity
    })
    const suggestedTags = await places.autocompleteTags(parsedText.tags)

    searchbarPlugins.reset('bangs')

    var tagBar = document.createElement('div')
    tagBar.id = 'bookmark-tag-bar'
    container.appendChild(tagBar)

    parsedText.tags.forEach(function (tag) {
      tagBar.appendChild(bookmarkEditor.getTagElement(tag, true, function () {
        tabEditor.show(tabs.getSelected(), '!bookmarks ' + text.replace('#' + tag, '').trim())
      }, {
        autoRemove: false,
        onModify: () => bookmarkManager.showBookmarks(text, input, event)
      }))
    })

    if (!parsedText.text) {
      suggestedTags.forEach(function (suggestion, index) {
        var el = bookmarkEditor.getTagElement(suggestion, false, function () {
          var needsSpace = text.slice(-1) !== ' ' && text.slice(-1) !== ''
          tabEditor.show(tabs.getSelected(), '!bookmarks ' + text + (needsSpace ? ' #' : '#') + suggestion + ' ')
        }, {
          onModify: () => bookmarkManager.showBookmarks(text, input, event)
        })
        if (index >= maxTagSuggestions) {
          el.classList.add('overflowing')
        }
        tagBar.appendChild(el)
      })

      if (suggestedTags.length > maxTagSuggestions) {
        var expandEl = bookmarkEditor.getTagElement('\u2026', false, function () {
          tagBar.classList.add('expanded')
          expandEl.remove()
        })
        tagBar.appendChild(expandEl)
      }
    }

    const filtered = results.filter(function (result) {
      return itemMatchesTags(result, parsedText.tags)
    })

    if (parsedText.text) {
      const seenUrls = new Set()
      filtered.sort(bookmarkUtils.sortByTitle)
      filtered.forEach(function (result, index) {
        const normalizedUrl = bookmarkUtils.normalizeBookmarkUrl(result.url)
        if (seenUrls.has(normalizedUrl)) {
          return
        }
        seenUrls.add(normalizedUrl)
        displayedURLset.push(result.url)
        var itemData = getBookmarkListItemData(result, index === 0)
        var placeholder = lazyList.createPlaceholder()
        container.appendChild(placeholder)
        lazyList.lazyRenderItem(placeholder, itemData)
      })
    } else {
      const groups = groupByFolder(filtered)
      groups.forEach(function (group) {
        if (group.items.length === 0) {
          return
        }
        searchbarPlugins.addHeading('bangs', { text: bookmarkUtils.getFolderDisplayName(group.folder) })
        group.items.forEach(function (result, index) {
          displayedURLset.push(result.url)
          var itemData = getBookmarkListItemData(result, index === 0 && groups[0] === group)
          var placeholder = lazyList.createPlaceholder()
          container.appendChild(placeholder)
          lazyList.lazyRenderItem(placeholder, itemData)
        })
      })
    }

    if (text === '' && results.length < 3) {
      container.appendChild(searchbarUtils.createItem({
        title: l('importBookmarks'),
        icon: 'carbon:upload',
        click: function () {
          searchbar.openURL('!importbookmarks', null)
        }
      }))
    }

    if (parsedText.tags.length > 0) {
      let suggestedResults = await places.getSuggestedItemsForTags(parsedText.tags)

      suggestedResults = suggestedResults.filter(res => !displayedURLset.includes(res.url))
      if (suggestedResults.length === 0) {
        return
      }
      searchbarPlugins.addHeading('bangs', { text: l('bookmarksSimilarItems') })
      suggestedResults.forEach(function (result) {
        var item = searchbarUtils.createItem(getBookmarkListItemData(result, false))
        container.appendChild(item)
      })
    }
  },
  initialize: function () {
    bangsPlugin.registerCustomBang({
      phrase: '!bookmarks',
      snippet: l('searchBookmarks'),
      isAction: false,
      showSuggestions: bookmarkManager.showBookmarks,
      fn: function (text) {
        var parsedText = parseBookmarkSearch(text)
        if (!parsedText.text) {
          return
        }
        places.searchPlaces(parsedText.text, { searchBookmarks: true })
          .then(function (results) {
            results = results
              .filter(r => itemMatchesTags(r, parsedText.tags))
              .sort(bookmarkUtils.sortByTitle)
            if (results.length !== 0) {
              searchbar.openURL(results[0].url, null)
            }
          })
      }
    })
  }
}

module.exports = bookmarkManager
