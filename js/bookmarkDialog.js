var places = require('places/places.js')
var urlParser = require('util/urlParser.js')
var bookmarkUtils = require('bookmarkUtils.js')

const bookmarkDialog = {
  modal: null,
  titleInput: null,
  folderSelect: null,
  urlDisplay: null,
  removeButton: null,
  saveButton: null,
  currentUrl: null,
  onClose: null,

  initialize: function () {
    bookmarkDialog.modal = document.getElementById('bookmark-dialog')
    if (!bookmarkDialog.modal) {
      return
    }

    bookmarkDialog.titleInput = document.getElementById('bookmark-dialog-title')
    bookmarkDialog.folderSelect = document.getElementById('bookmark-dialog-folder')
    bookmarkDialog.urlDisplay = document.getElementById('bookmark-dialog-url')
    bookmarkDialog.removeButton = document.getElementById('bookmark-dialog-remove')
    bookmarkDialog.saveButton = document.getElementById('bookmark-dialog-save')

    document.getElementById('bookmark-dialog-close').addEventListener('click', function () {
      bookmarkDialog.hide(true)
    })

    bookmarkDialog.saveButton.addEventListener('click', function () {
      bookmarkDialog.save()
    })

    bookmarkDialog.removeButton.addEventListener('click', function () {
      bookmarkDialog.remove()
    })

    bookmarkDialog.modal.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        bookmarkDialog.hide(true)
      } else if (e.key === 'Enter' && e.target !== bookmarkDialog.folderSelect) {
        e.preventDefault()
        bookmarkDialog.save()
      }
    })
  },

  populateFolders: async function (selectedFolder) {
    const folders = await bookmarkUtils.getAllFolders()
    bookmarkDialog.folderSelect.innerHTML = ''

    folders.forEach(function (folder) {
      const option = document.createElement('option')
      option.value = folder
      option.textContent = bookmarkUtils.getFolderDisplayName(folder)
      if (folder === selectedFolder) {
        option.selected = true
      }
      bookmarkDialog.folderSelect.appendChild(option)
    })
  },

  show: async function (url, options) {
    if (!bookmarkDialog.modal) {
      bookmarkDialog.initialize()
    }
    if (!bookmarkDialog.modal) {
      return
    }

    url = bookmarkUtils.normalizeBookmarkUrl(url)
    bookmarkDialog.currentUrl = url
    bookmarkDialog.onClose = options && options.onClose

    const tab = tabs.get(tabs.getSelected())
    const found = await bookmarkUtils.findBookmarkByNormalizedUrl(url)
    let bookmark = found.item

    if (!bookmark || !bookmark.isBookmarked) {
      bookmark = {
        url: url,
        title: (tab && tab.url === url) ? tab.title : url,
        tags: [bookmarkUtils.BAR_TAG],
        isBookmarked: true
      }
      bookmarkDialog.removeButton.hidden = true
      bookmarkDialog.modal.querySelector('.modal-title').textContent = l('addBookmark')
    } else {
      bookmarkDialog.removeButton.hidden = false
      bookmarkDialog.modal.querySelector('.modal-title').textContent = l('editBookmark')
    }

    bookmarkDialog.titleInput.value = bookmark.title || ''
    bookmarkDialog.urlDisplay.textContent = urlParser.basicURL(urlParser.getSourceURL(url))

    const folder = bookmarkUtils.getPrimaryFolder(bookmark.tags)
    await bookmarkDialog.populateFolders(folder)

    bookmarkDialog.modal.hidden = false
    document.body.classList.add('is-modal-mode')
    bookmarkDialog.titleInput.focus()
    bookmarkDialog.titleInput.select()
  },

  hide: function (cancelled) {
    if (!bookmarkDialog.modal) {
      return
    }
    bookmarkDialog.modal.hidden = true
    document.body.classList.remove('is-modal-mode')

    if (bookmarkDialog.onClose) {
      const callback = bookmarkDialog.onClose
      bookmarkDialog.onClose = null
      if (cancelled) {
        callback(false)
      }
    }
  },

  save: async function () {
    const title = bookmarkDialog.titleInput.value.trim()
    const folder = bookmarkDialog.folderSelect.value
    const url = bookmarkUtils.normalizeBookmarkUrl(bookmarkDialog.currentUrl)

    const found = await bookmarkUtils.findBookmarkByNormalizedUrl(url)
    let tags = found.item && found.item.tags ? found.item.tags.slice() : []
    tags = bookmarkUtils.applyFolderToTags(tags, folder)

    await places.updateItem(url, {
      isBookmarked: true,
      title: title || url,
      tags: tags
    })

    if (found.item && found.url !== url) {
      places.deleteHistory(found.url)
    }
    await bookmarkUtils.removeDuplicateBookmarks(url)

    if (bookmarkDialog.onClose) {
      const callback = bookmarkDialog.onClose
      bookmarkDialog.onClose = null
      callback({ url: url, title: title, tags: tags })
    }

    bookmarkDialog.modal.hidden = true
    document.body.classList.remove('is-modal-mode')

    try {
      require('navbar/bookmarkBar.js').refresh()
    } catch (e) {}
  },

  remove: async function () {
    const url = bookmarkUtils.normalizeBookmarkUrl(bookmarkDialog.currentUrl)
    places.deleteHistory(url)

    if (bookmarkDialog.onClose) {
      const callback = bookmarkDialog.onClose
      bookmarkDialog.onClose = null
      callback(null)
    }

    bookmarkDialog.modal.hidden = true
    document.body.classList.remove('is-modal-mode')

    try {
      require('navbar/bookmarkBar.js').refresh()
    } catch (e) {}
  }
}

module.exports = bookmarkDialog
