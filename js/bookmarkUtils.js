var places = require('places/places.js')
var urlParser = require('util/urlParser.js')

const BAR_TAG = 'bookmarks-bar'
const OTHER_TAG = 'other-bookmarks'
const BAR_FOLDER_PREFIX = 'bar-folder-'

const BAR_TAG_ALIASES = ['bookmarks-bar', 'bookmarks bar', 'bookmarksbar']

function normalizeTag (tag) {
  return (tag || '').trim().replace(/\s/g, '-')
}

function isBarTag (tag) {
  return BAR_TAG_ALIASES.includes((tag || '').toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim()) ||
    (tag || '').toLowerCase() === BAR_TAG
}

function isBarFolderTag (tag) {
  return (tag || '').startsWith(BAR_FOLDER_PREFIX)
}

function getBarFolderName (tag) {
  return tag.substring(BAR_FOLDER_PREFIX.length).replace(/-/g, ' ')
}

function isOnBar (item) {
  if (!item || !item.isBookmarked) {
    return false
  }
  if (!item.tags || item.tags.length === 0) {
    return true
  }
  if (item.tags.includes(OTHER_TAG) && !item.tags.some(isBarTag) && !item.tags.some(isBarFolderTag)) {
    return false
  }
  return item.tags.some(function (tag) {
    return isBarTag(tag) || isBarFolderTag(tag)
  })
}

function getBarFolderTag (item) {
  if (!item || !item.tags) {
    return null
  }
  return item.tags.find(isBarFolderTag) || null
}

function getPrimaryFolder (tags) {
  if (!tags || tags.length === 0) {
    return BAR_TAG
  }
  const barFolder = tags.find(isBarFolderTag)
  if (barFolder) {
    return barFolder
  }
  if (tags.some(isBarTag)) {
    return BAR_TAG
  }
  if (tags.includes(OTHER_TAG)) {
    return OTHER_TAG
  }
  const folder = tags.find(function (tag) {
    return !isBarTag(tag) && !isBarFolderTag(tag) && tag !== OTHER_TAG
  })
  return folder || OTHER_TAG
}

function getFolderDisplayName (folder) {
  if (isBarTag(folder)) {
    return l('bookmarksFolderBar')
  }
  if (folder === OTHER_TAG) {
    return l('bookmarksFolderOther')
  }
  if (isBarFolderTag(folder)) {
    return getBarFolderName(folder)
  }
  return folder.replace(/-/g, ' ')
}

function normalizeBookmarkUrl (url) {
  url = urlParser.removeTextFragment(urlParser.getSourceURL(url))
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1)
    }
    return parsed.href
  } catch (e) {
    return url
  }
}

async function findBookmarkByNormalizedUrl (url) {
  const normalized = normalizeBookmarkUrl(url)
  let item = await places.getItem(normalized)
  if (item && item.isBookmarked) {
    return { item: item, url: normalized }
  }

  const items = await places.getAllItems()
  for (let i = 0; i < items.length; i++) {
    const candidate = items[i]
    if (candidate.isBookmarked && normalizeBookmarkUrl(candidate.url) === normalized) {
      return { item: candidate, url: candidate.url }
    }
  }

  return { item: null, url: normalized }
}

async function removeDuplicateBookmarks (canonicalUrl) {
  const normalized = normalizeBookmarkUrl(canonicalUrl)
  const items = await places.getAllItems()
  items.forEach(function (item) {
    if (!item.isBookmarked) {
      return
    }
    if (item.url === normalized) {
      return
    }
    if (normalizeBookmarkUrl(item.url) === normalized) {
      places.deleteHistory(item.url)
    }
  })
}

function dedupeTags (tags) {
  const seen = new Set()
  return (tags || []).filter(function (tag) {
    if (!tag || seen.has(tag)) {
      return false
    }
    seen.add(tag)
    return true
  })
}

function applyFolderToTags (tags, folder) {
  tags = (tags || []).filter(function (tag) {
    return !isBarTag(tag) && !isBarFolderTag(tag) && tag !== OTHER_TAG
  })

  if (folder === BAR_TAG || isBarTag(folder)) {
    tags.push(BAR_TAG)
  } else if (folder === OTHER_TAG) {
    tags.push(OTHER_TAG)
  } else if (isBarFolderTag(folder)) {
    tags.push(folder)
  } else if (folder) {
    tags.push(normalizeTag(folder))
  }

  return dedupeTags(tags)
}

function getBookmarkTitle (item) {
  return item.title || urlParser.basicURL(urlParser.getSourceURL(item.url))
}

function sortByTitle (a, b) {
  return getBookmarkTitle(a).toLowerCase().localeCompare(getBookmarkTitle(b).toLowerCase())
}

function sortByDateAdded (a, b) {
  return (b.lastVisit || 0) - (a.lastVisit || 0)
}

async function getAllFolders () {
  const items = await places.getAllItems()
  const folders = new Set([BAR_TAG, OTHER_TAG])

  items.forEach(function (item) {
    if (!item.isBookmarked) {
      return
    }
    item.tags.forEach(function (tag) {
      if (!isBarTag(tag)) {
        folders.add(tag)
      }
    })
  })

  const folderList = Array.from(folders)
  folderList.sort(function (a, b) {
    if (a === BAR_TAG) return -1
    if (b === BAR_TAG) return 1
    if (a === OTHER_TAG) return -1
    if (b === OTHER_TAG) return 1
    return getFolderDisplayName(a).localeCompare(getFolderDisplayName(b))
  })

  return folderList
}

function normalizeImportedFolderTag (folderName) {
  const normalized = normalizeTag(folderName)
  if (isBarTag(normalized) || isBarTag(folderName)) {
    return BAR_TAG
  }
  if (folderName && folderName.toLowerCase().includes('other') && folderName.toLowerCase().includes('bookmark')) {
    return OTHER_TAG
  }
  return normalized
}

const bookmarkUtils = {
  BAR_TAG,
  OTHER_TAG,
  BAR_FOLDER_PREFIX,
  normalizeTag,
  isBarTag,
  isBarFolderTag,
  getBarFolderName,
  isOnBar,
  getBarFolderTag,
  getPrimaryFolder,
  getFolderDisplayName,
  applyFolderToTags,
  getBookmarkTitle,
  sortByTitle,
  sortByDateAdded,
  getAllFolders,
  normalizeImportedFolderTag,
  normalizeBookmarkUrl,
  dedupeTags,
  findBookmarkByNormalizedUrl,
  removeDuplicateBookmarks
}

module.exports = bookmarkUtils
