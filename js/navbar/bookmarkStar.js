const places = require('places/places.js')
const bookmarkDialog = require('bookmarkDialog.js')
const bookmarkUtils = require('bookmarkUtils.js')

const bookmarkStar = {
  create: function () {
    const star = document.createElement('button')
    star.className = 'tab-editor-button bookmarks-button i carbon:star'
    star.setAttribute('aria-pressed', false)
    star.setAttribute('title', l('addBookmark'))
    star.setAttribute('aria-label', l('addBookmark'))

    star.addEventListener('click', function () {
      bookmarkStar.onClick(star)
    })

    return star
  },

  onClick: function (star) {
    var tabId = star.getAttribute('data-tab')
    var url = bookmarkUtils.normalizeBookmarkUrl(tabs.get(tabId).url)

    if (!url) {
      return
    }

    places.getItem(url).then(function (item) {
      if (item && item.isBookmarked) {
        bookmarkDialog.show(url, {
          onClose: function () {
            bookmarkStar.update(tabId, star)
          }
        })
      } else {
        places.updateItem(url, {
          isBookmarked: true,
          title: tabs.get(tabId).title,
          tags: [bookmarkUtils.BAR_TAG]
        }).then(function () {
          star.classList.remove('carbon:star')
          star.classList.add('carbon:star-filled')
          star.setAttribute('aria-pressed', true)

          try {
            require('navbar/bookmarkBar.js').refresh()
          } catch (e) {}

          bookmarkDialog.show(url, {
            onClose: function () {
              bookmarkStar.update(tabId, star)
            }
          })
        })
      }
    })
  },

  update: function (tabId, star) {
    star.setAttribute('data-tab', tabId)
    const currentURL = bookmarkUtils.normalizeBookmarkUrl(tabs.get(tabId).url)

    if (!currentURL) {
      star.hidden = true
    } else {
      star.hidden = false
    }

    places.getItem(currentURL).then(function (item) {
      if (item && item.isBookmarked) {
        star.classList.remove('carbon:star')
        star.classList.add('carbon:star-filled')
        star.setAttribute('aria-pressed', true)
        star.setAttribute('title', l('editBookmark'))
        star.setAttribute('aria-label', l('editBookmark'))
      } else {
        star.classList.add('carbon:star')
        star.classList.remove('carbon:star-filled')
        star.setAttribute('aria-pressed', false)
        star.setAttribute('title', l('addBookmark'))
        star.setAttribute('aria-label', l('addBookmark'))
      }
    })
  }
}

module.exports = bookmarkStar
