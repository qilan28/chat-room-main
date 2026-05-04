// 文件名: script.js
// 描述：前端逻辑
// 版本: 1.0.0
// 作者: woshimaniubi8
// 日期: 2025-08-09

const SRC_URL = window.location.origin // 服务器地址
const WS_URL = window.location.origin.replace('http', 'ws') // WebSocket地址
const electron_build = false // 是否为electron构建

// 用户认证变量
let userToken = localStorage.getItem('userToken')
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null')
let allUsers = []
let notifications = []
let privateConversations = []

///////////////////////////////////////////////////////
// 你好，我是孩子家长，我看看到了孩子受气，
// 我也是无意间 看到你们聊天的记录的，你说这话是什么意思？
// 说出的话我 都不敢想。你是学生还是什么样的人？
// 还有出门也这样说话吗？我真的不敢想象你的家长，难道就不管你吗
///////////////////////////////////////////////////////
// 用户配置
const usernamea = localStorage.getItem('username') || Math.random().toString(36).substring(2, 15)
let userConfig = {
  username: usernamea,
  avatar: localStorage.getItem('avatar') || `https://ui-avatars.com/api/?name=${usernamea}&background=random`,
}
localStorage.setItem('username', usernamea)
localStorage.setItem('avatar', localStorage.getItem('avatar') || `https://ui-avatars.com/api/?name=${usernamea}&background=random`)
let attachments = []
let autoChange = true
let lastContent = []
let NoticeContent = '欢迎加入聊天室！你可以点击右上角的设置按钮自定义你的用户名和头像。<br><h4 class="sys_msg">信息支持html标签哦~</h4>'
let roomConfig = {}
let badgesData = {}
let currentContextMessage = null
let isAdmin = false
let currentQuoteMessage = null
let mentionUsers = [] // @的用户列表

const userInput = document.getElementById('set-username')
const avatarInput = document.getElementById('set-avatar')
const loadD = document.getElementById('loading-screen')
const avatarPreview = document.getElementById('avatar-preview')
const fileInput = document.getElementById('file-input')
const fujianPreview = document.getElementById('attachments-preview')
const avatarFileInput = document.getElementById('avatar-file-input')
const avatarFileName = document.getElementById('avatar-file-name')
const messagesContainer = document.getElementById('messages-container')
const scrollToBottomBtn = document.getElementById('scroll-to-bottom')

function initUserConfig() {
  // 优先使用登录用户信息
  const displayUsername = currentUser ? currentUser.username : userConfig.username
  const displayAvatar = currentUser ? currentUser.avatar : userConfig.avatar
  
  document.getElementById('current-user-name').textContent = displayUsername
  document.getElementById('current-user-avatar').src = displayAvatar
  avatarPreview.src = displayAvatar
  userInput.value = displayUsername
  avatarInput.value = displayAvatar
}

function initLocalMessages() {
  let localMessages = []
  localMessages = localStorage.getItem('message_data')
  if (localMessages) {
    try {
      JSON.parse(localMessages).forEach((message) => {
        // 使用登录用户信息判断
        const currentUsername = currentUser ? currentUser.username : userConfig.username
        const isSelf = message.username === currentUsername
        displayMessage(message, isSelf)
      })
      lattttMessages = JSON.parse(localMessages)
    } catch (e) {
      console.error('解析本地消息失败:', e)
      localMessages = []
    }
  }
}

function displayMessage(message, isSelf = false) {
  const messagebbb = document.createElement('div')
  messagebbb.classList.add('message')
  messagebbb.classList.add(isSelf ? 'self' : 'other')
  messagebbb.dataset.messageId = message.id
  messagebbb.dataset.username = message.username

  const date = new Date(message.timestamp)
  const timeString = date.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  if (message.avatar.startsWith('http')) {
    message.avatar = message.avatar
  } else {
    message.avatar = SRC_URL + message.avatar
  }

  // 获取用户铭牌
  const userBadges = getUserBadges(message.username)

  // 消息内容HTML
  let msgContent = `
            <img class="avatar" src="${message.avatar}" alt="${message.username}">
            <div class="message-content">
                <div class="message-header">
                    <span class="sender">${isSelf ? '你' : message.username}${userBadges}</span>
                </div>
        `

  // 引用消息
  if (message.quoteMessage) {
    const quoteText = message.quoteMessage.text || '[附件消息]'
    msgContent += `
      <div class="quote-message" data-quote-id="${message.quoteMessage.id}">
        <div class="quote-author">
          <i class="fas fa-reply"></i>
          ${message.quoteMessage.username}
        </div>
        <div class="quote-content">${quoteText}</div>
      </div>
    `
  }

  // 文本内容
  if (message.text) {
    msgContent += `<div class="message-text">${message.text}</div>`
  }

  // 附件
  if (message.attachments && message.attachments.length > 0) {
    msgContent += `<div class="message-attachments">`

    message.attachments.forEach((attachment) => {
      if (attachment.type === 'image') {
        msgContent += `
                        <div class="message-attachment">
                            <img src="${SRC_URL}${attachment.url}" alt="${attachment.name}" onclick="window.open('${SRC_URL}${attachment.url}', '_blank')">
                        </div>
                    `
      } else if (attachment.type === 'video') {
        msgContent += `
                        <div class="message-attachment">
                            <video width="100%" src="${SRC_URL}${attachment.url}" controls>
                        </div>
                    `
      } else if (attachment.type === 'audio') {
        msgContent += `
                        <div class="message-attachment">
                            <audio src="${SRC_URL}${attachment.url}"controls style="max-width: 200px; max-height: 230px; border-radius: 5px; margin-right: 10px;"></audio>
                        </div>
                    `
      } else {
        const fileType = getFileTypeIcon(attachment.name.split('.').pop())
        msgContent += `
                        <div class="message-attachment">
                            <a href="${SRC_URL}${attachment.url}" target="_blank" class="file-preview links">
                                <i class="fas fa-${fileType.icon}" style="color: ${fileType.color};font-size:30px;"></i>
                                <p>${attachment.name}</p>
                            </a>
                        </div>
                    `
      }
    })

    msgContent += `</div>`
  }

  // 时间
  msgContent += `
                <div class="message-time">${timeString}</div>
            </div>
        `

  messagebbb.innerHTML = msgContent

  // 添加右键菜单事件
  messagebbb.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    showContextMenu(e, message, isSelf)
  })

  // 移动端长按事件
  let longPressTimer
  messagebbb.addEventListener('touchstart', (e) => {
    longPressTimer = setTimeout(() => {
      showContextMenu(e.touches[0], message, isSelf)
    }, 500)
  })

  messagebbb.addEventListener('touchend', () => {
    clearTimeout(longPressTimer)
  })

  messagebbb.addEventListener('touchmove', () => {
    clearTimeout(longPressTimer)
  })

  messagesContainer.appendChild(messagebbb)
  
  // 检查是否在底部，如果是则自动滚动
  const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100
  if (isAtBottom) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight
  }

  // 引用消息点击跳转
  const quoteElement = messagebbb.querySelector('.quote-message')
  if (quoteElement) {
    quoteElement.addEventListener('click', () => {
      const quoteId = quoteElement.dataset.quoteId
      scrollToMessage(quoteId)
    })
  }
}

// 滚动到指定消息
function scrollToMessage(messageId) {
  const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`)
  if (targetMessage) {
    targetMessage.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // 高亮效果
    targetMessage.style.animation = 'highlight 1s'
    setTimeout(() => {
      targetMessage.style.animation = ''
    }, 1000)
  } else {
    toastr.info('原消息已被删除或不存在')
  }
}

// 获取用户铭牌 HTML
function getUserBadges(username) {
  if (!badgesData.userBadges || !badgesData.userBadges[username]) {
    return ''
  }

  const userBadgeIds = badgesData.userBadges[username]
  let badgesHTML = ''

  userBadgeIds.forEach((badgeId) => {
    const badge = badgesData.badges.find((b) => b.id === badgeId)
    if (badge) {
      badgesHTML += `
        <span class="user-badge" style="color: ${badge.color}; background-color: ${badge.bgColor};">
          <span class="badge-icon">${badge.icon}</span>
          <span>${badge.name}</span>
        </span>
      `
    }
  })

  return badgesHTML
}

// 显示右键菜单
function showContextMenu(e, message, isSelf) {
  const menu = document.getElementById('message-context-menu')
  const recallItem = document.getElementById('recall-menu-item')
  const deleteItem = document.getElementById('delete-menu-item')
  const adminDivider = document.getElementById('admin-menu-divider')

  currentContextMessage = message

  // 显示/隐藏管理员菜单项
  if (isSelf) {
    recallItem.style.display = 'flex'
    deleteItem.style.display = 'none'
    adminDivider.style.display = 'block'
  } else if (isAdmin) {
    recallItem.style.display = 'none'
    deleteItem.style.display = 'flex'
    adminDivider.style.display = 'block'
  } else {
    recallItem.style.display = 'none'
    deleteItem.style.display = 'none'
    adminDivider.style.display = 'none'
  }

  // 定位菜单
  menu.style.display = 'block'
  menu.style.left = e.clientX + 'px'
  menu.style.top = e.clientY + 'px'

  // 防止菜单超出屏幕
  const menuRect = menu.getBoundingClientRect()
  if (menuRect.right > window.innerWidth) {
    menu.style.left = window.innerWidth - menuRect.width - 10 + 'px'
  }
  if (menuRect.bottom > window.innerHeight) {
    menu.style.top = window.innerHeight - menuRect.height - 10 + 'px'
  }
}

// 隐藏右键菜单
function hideContextMenu() {
  const menu = document.getElementById('message-context-menu')
  menu.style.display = 'none'
  currentContextMessage = null
}

// 处理菜单操作
function handleContextMenuAction(action) {
  if (!currentContextMessage) return

  switch (action) {
    case 'copy':
      copyMessage(currentContextMessage)
      break
    case 'forward':
      forwardMessage(currentContextMessage)
      break
    case 'quote':
      quoteMessage(currentContextMessage)
      break
    case 'recall':
      recallMessage(currentContextMessage)
      break
    case 'delete':
      deleteMessage(currentContextMessage)
      break
  }

  hideContextMenu()
}

// 复制消息
function copyMessage(message) {
  const text = message.text || '[附件消息]'
  navigator.clipboard
    .writeText(text)
    .then(() => {
      toastr.success('复制成功')
    })
    .catch(() => {
      toastr.error('复制失败')
    })
}

// 转发消息
function forwardMessage(message) {
  const messageInput = document.getElementById('message-input')
  messageInput.value = `[转发] ${message.username}: ${message.text || '[附件消息]'}`
  messageInput.focus()
  toastr.info('请编辑后发送')
}

// 引用消息
function quoteMessage(message) {
  currentQuoteMessage = message

  // 显示引用预览
  const quotePreview = document.getElementById('quote-preview')
  const quoteAuthor = document.getElementById('quote-preview-author')
  const quoteContent = document.getElementById('quote-preview-content')

  quoteAuthor.textContent = `回复 @${message.username}`
  quoteContent.textContent = message.text || '[附件消息]'
  quotePreview.classList.add('active')

  // 聚焦输入框
  const messageInput = document.getElementById('message-input')
  messageInput.focus()
}

// 取消引用
function cancelQuote() {
  currentQuoteMessage = null
  const quotePreview = document.getElementById('quote-preview')
  quotePreview.classList.remove('active')
}

// 撤回消息
async function recallMessage(message) {
  if (!confirm('确定要撤回这条消息吗？')) return

  try {
    const response = await fetch(`${SRC_URL}/messages/${message.id}`, {
      method: 'DELETE',
    })

    if (response.ok) {
      toastr.success('消息已撤回')
      // 移除DOM元素
      const messageElement = document.querySelector(`[data-message-id="${message.id}"]`)
      if (messageElement) {
        messageElement.remove()
      }
    } else {
      toastr.error('撤回失败')
    }
  } catch (error) {
    console.error('撤回消息失败:', error)
    toastr.error('撤回失败')
  }
}

// 删除消息（管理员）
async function deleteMessage(message) {
  if (!confirm('确定要删除这条消息吗？')) return

  try {
    const response = await fetch(`${SRC_URL}/messages/${message.id}`, {
      method: 'DELETE',
    })

    if (response.ok) {
      toastr.success('消息已删除')
      // 移除DOM元素
      const messageElement = document.querySelector(`[data-message-id="${message.id}"]`)
      if (messageElement) {
        messageElement.remove()
      }
    } else {
      toastr.error('删除失败')
    }
  } catch (error) {
    console.error('删除消息失败:', error)
    toastr.error('删除失败')
  }
}

// 获取文件类型图标
function getFileTypeIcon(ext) {
  //叼你妈的，一个个添加太死人了
  const icons = {
    pdf: { icon: 'file-pdf', color: '#e74c3c' },
    zip: { icon: 'file-archive', color: '#9b59b6' },
    apk: { icon: 'file-archive', color: '#9b59b6' },
    '7z': { icon: 'file-archive', color: '#9b59b6' },
    rar: { icon: 'file-archive', color: '#9b59b6' },
    jar: { icon: 'file-archive', color: '#9b59b6' },
    mp3: { icon: 'file-audio', color: '#1abc9c' },
    wav: { icon: 'file-audio', color: '#1abc9c' },
    flac: { icon: 'file-audio', color: '#1abc9c' },
    aac: { icon: 'file-audio', color: '#1abc9c' },
    m3u: { icon: 'file-audio', color: '#1abc9c' },
    mp4: { icon: 'file-video', color: '#d35400' },
    mov: { icon: 'file-video', color: '#d35400' },
    mkv: { icon: 'file-video', color: '#d35400' },
    m3u8: { icon: 'file-video', color: '#d35400' },
    flv: { icon: 'file-video', color: '#d35400' },
    avi: { icon: 'file-video', color: '#d35400' },
    txt: { icon: 'file-alt', color: '#7f8c8d' },
    md: { icon: 'file-alt', color: '#7f8c8d' },
    csv: { icon: 'file-csv', color: '#f39c12' },
    json: { icon: 'file-code', color: '#8e44ad' },
    c: { icon: 'file-code', color: '#8e44ad' },
    cpp: { icon: 'file-code', color: '#8e44ad' },
    h: { icon: 'file-code', color: '#8e44ad' },
    html: { icon: 'file-code', color: '#8e44ad' },
    htm: { icon: 'file-code', color: '#8e44ad' },
    js: { icon: 'file-code', color: '#8e44ad' },
    css: { icon: 'file-code', color: '#8e44ad' },
    go: { icon: 'file-code', color: '#8e44ad' },
    spec: { icon: 'file-code', color: '#8e44ad' },
    py: { icon: 'file-code', color: '#8e44ad' },
    rb: { icon: 'file-code', color: '#8e44ad' },
    cmd: { icon: 'file-code', color: '#8e44ad' },
    ps1: { icon: 'file-code', color: '#8e44ad' },
    bat: { icon: 'file-code', color: '#8e44ad' },
    sh: { icon: 'file-code', color: '#8e44ad' },
    java: { icon: 'file-code', color: '#8e44ad' },
    xml: { icon: 'file-xml', color: '#8e44ad' },
    doc: { icon: 'file-word', color: '#2488e6ff' },
    docx: { icon: 'file-word', color: '#2488e6ff' },
    docm: { icon: 'file-word', color: '#2488e6ff' },
    ppt: { icon: 'file-ppt', color: '#e63124ff' },
    pptx: { icon: 'file-ppt', color: '#e63124ff' },
    pptm: { icon: 'file-ppt', color: '#e63124ff' },
    xls: { icon: 'file-excel', color: '#24e69cff' },
    xlsx: { icon: 'file-excel', color: '#24e69cff' },
    xlsm: { icon: 'file-excel', color: '#24e69cff' },
    ttf: { icon: 'font', color: '#eff31cff' },
    woff: { icon: 'font', color: '#eff31cff' },
    woff2: { icon: 'font', color: '#eff31cff' },
    default: { icon: 'file', color: '#95a5a6' },
  }

  return icons[ext.toLowerCase()] || icons.default
}
let old_message
// 获取消息
let lattttMessages = [] // 存储上次获取的消息数组

async function fetchMessages() {
  try {
    const response = await fetch(`${SRC_URL}/messages`)
    if (!response.ok) throw new Error('获取消息失败')

    const responseText = await response.text()
    const newMessages = responseText ? JSON.parse(responseText) : []
    // 检测新消息
    const addedMessages = newMessages.filter(
      (newMsg) =>
        !lattttMessages.some(
          (oldMsg) => oldMsg.id === newMsg.id // 假设消息有唯一ID
        )
    )

    // 仅渲染新增消息
    addedMessages.forEach((message) => {
      // 使用登录用户信息判断
      const currentUsername = currentUser ? currentUser.username : userConfig.username
      const isSelf = message.username === currentUsername
      displayMessage(message, isSelf)
    })

    // 更新消息记录
    localStorage.setItem('message_data', responseText)
    lattttMessages = responseText ? JSON.parse(responseText) : newMessages
  } catch (error) {
    toastr.error('获取消息失败:' + error.message)
  }
}

// 处理文件选择
function handleFileSelect(e) {
  const files = Array.from(e.target.files)
  if (files.length === 0) return

  files.forEach((file) => {
    const reader = new FileReader()

    reader.onload = function (e) {
      const attachment = {
        file: file,
        dataUrl: e.target.result,
        type: file.type.split('/')[0],
        name: file.name,
      }

      attachments.push(attachment)
      renderfujianPreview(attachment)
    }

    reader.readAsDataURL(file)
  })

  fileInput.value = ''
}

// 渲染附件预览
function renderfujianPreview(attachment) {
  const item = document.createElement('div')
  item.className = 'attachment-item'

  if (attachment.type === 'image') {
    item.innerHTML = `
                <img src="${attachment.dataUrl}" alt="${attachment.name}">
                <button class="remove-attachment">&times;</button>
            `
  } else {
    const fileType = getFileTypeIcon(attachment.name.split('.').pop())

    item.innerHTML = `
                <div class="file-icon">
                    <i class="fas fa-${fileType.icon}"></i>
                    <div class="file-name">${attachment.name}</div>
                </div>
                <button class="remove-attachment">&times;</button>
            `
  }

  item.querySelector('.remove-attachment').addEventListener('click', () => {
    attachments = attachments.filter((a) => a !== attachment)
    item.remove()
  })

  fujianPreview.appendChild(item)
}
const messageInput = document.getElementById('message-input')
// 发送消息
async function sendMessage() {
  const text = messageInput.value.trim()
  if (!text && attachments.length === 0) return

  // 上传附件
  const attachmentUrls = []
  if (attachments.length > 0) {
    try {
      loadD.style.display = 'flex' // 显示加载屏幕
      for (const attachment of attachments) {
        const formData = new FormData()
        // 对文件名进行编码
        const encodedName = encodeURIComponent(attachment.file.name)
        formData.append('file', attachment.file, encodedName)

        const response = await fetch(`${SRC_URL}/upload`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) throw new Error('附件上传失败')

        const result = await response.json()
        // 注意：这里上传接口返回的是数组，但我们是一个一个上传的，所以取第一个
        if (result && result.length > 0) {
          attachmentUrls.push(result[0])
        }
      }
    } catch (error) {
      console.error('附件上传失败:', error)
      toastr.error('部分附件上传失败，请检查文件大小 ≤ 2000MB')
      loadD.style.display = 'none' // 隐藏加载屏幕
      return
    }

    loadD.style.display = 'none' // 隐藏加载屏幕
  }

  // 使用登录用户信息
  const username = currentUser ? currentUser.username : (userConfig.username || '用户')
  const avatar = currentUser ? currentUser.avatar : (userConfig.avatar || 'https://ui-avatars.com/api/?name=User&background=random')

  const message = {
    username: username,
    avatar: avatar,
    text: text,
    attachments: attachmentUrls,
    timestamp: new Date().toISOString(),
    id: Math.random().toString(36).substring(2, 30) + Date.now(), // msgID
  }

  // 添加引用信息
  if (currentQuoteMessage) {
    message.quoteMessage = {
      id: currentQuoteMessage.id,
      username: currentQuoteMessage.username,
      text: currentQuoteMessage.text,
    }
  }

  try {
    const response = await fetch(`${SRC_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    })

    if (response.ok) {
      // 如果有引用回复，创建通知
      if (currentQuoteMessage && currentUser) {
        const quotedUsername = currentQuoteMessage.username
        // 找到被引用用户的ID
        const quotedUser = allUsers.find(u => u.username === quotedUsername)
        if (quotedUser && quotedUser.id !== currentUser.id) {
          // 创建回复通知
          fetch(`${SRC_URL}/notifications/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({
              userId: quotedUser.id,
              type: 'reply',
              data: {
                fromUsername: currentUser.username,
                messageId: message.id,
                text: text
              }
            })
          }).catch(err => console.error('创建通知失败:', err))
        }
      }
      messageInput.value = ''
      attachments = []
      fujianPreview.innerHTML = ''
      cancelQuote() // 清除引用
      
      // 立即显示自己发送的消息
      displayMessage(message, true)
      
      // 将消息添加到本地缓存，防止重复显示
      lattttMessages.push(message)
      localStorage.setItem('message_data', JSON.stringify(lattttMessages))
      
      // 发送消息后滚动到底部
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight
      }, 100)
      
      // 检测@提及并创建通知
      if (currentUser && text) {
        const mentionRegex = /@([\u4e00-\u9fa5a-zA-Z0-9_]+)/g
        let match
        while ((match = mentionRegex.exec(text)) !== null) {
          const mentionedUsername = match[1]
          const mentionedUser = allUsers.find(u => u.username === mentionedUsername)
          if (mentionedUser && mentionedUser.id !== currentUser.id) {
            // 创建@通知
            fetch(`${SRC_URL}/notifications/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
              },
              body: JSON.stringify({
                userId: mentionedUser.id,
                type: 'mention',
                data: {
                  fromUsername: currentUser.username,
                  messageId: message.id,
                  text: text
                }
              })
            }).catch(err => console.error('创建@通知失败:', err))
          }
        }
      }
    } else {
      toastr.error('消息发送失败')
    }
  } catch (error) {
    toastr.error('发送消息失败:' + error.message)
  }
}
const settingsM = document.getElementById('settings-modal')
// 保存设置
async function saveSettings() {
  const newUsername = userInput.value.trim() || '用户'
  let newAvatar = avatarInput.value.trim()

  // 如果选择了头像文件，则上传
  if (avatarFileInput.files.length > 0) {
    //
    loadD.style.display = 'flex' // 隐藏加载屏幕
    try {
      const formData = new FormData()
      formData.append('avatar', avatarFileInput.files[0])

      const response = await fetch(`${SRC_URL}/upload-avatar`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('头像上传失败')

      const result = await response.json()
      newAvatar = SRC_URL + result.url
    } catch (error) {
      loadD.style.display = 'none' // 隐藏加载屏幕
      console.error('头像上传失败:', error)
      toastr.error('头像上传失败，使用默认头像')
      newAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(newUsername)}&background=random`
    }
  } else if (!newAvatar) {
    loadD.style.display = 'none' // 隐藏加载屏幕
    newAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(newUsername)}&background=random`
  }
  loadD.style.display = 'none' // 隐藏加载屏幕
  // 更新配置
  userConfig.username = newUsername
  userConfig.avatar = newAvatar
  localStorage.setItem('username', newUsername)
  localStorage.setItem('avatar', newAvatar)

  document.getElementById('current-user-name').textContent = newUsername
  document.getElementById('current-user-avatar').src = newAvatar
  avatarPreview.src = newAvatar
  fetchOnlineUsers()
  settingsM.style.display = 'none'
  toastr.success('设置已保存')
}

// 获取在线用户
async function fetchOnlineUsers() {
  try {
    const response = await fetch(`${SRC_URL}/online-users`)
    if (!response.ok) throw new Error('获取在线用户失败')

    const users = await response.json()
    renderOnlineUsers(users)
  } catch (error) {
    console.error('获取在线用户失败:', error)
    toastr.error('获取在线用户失败')
  }
}

async function fetchRoomConfig() {
  try {
    const response = await fetch(`${SRC_URL}/config`)
    if (!response.ok) throw new Error('获取配置失败')
    roomConfig = await response.json()
    // 更新聊天室名称
    const chatHeader = document.querySelector('.chat-header h2')
    if (chatHeader && roomConfig.roomName) {
      chatHeader.textContent = roomConfig.roomName
    }

    // 应用系统消息样式
    if (roomConfig.systemMessageStyle) {
      applySystemMessageStyle(roomConfig.systemMessageStyle)
    }
  } catch (error) {
    console.log('获取配置失败:', error)
  }
}

// 获取铭牌数据
async function fetchBadges() {
  try {
    const response = await fetch(`${SRC_URL}/badges`)
    if (!response.ok) throw new Error('获取铭牌失败')
    badgesData = await response.json()
  } catch (error) {
    console.log('获取铭牌失败:', error)
    badgesData = { badges: [], userBadges: {} }
  }
}

// 应用系统消息样式
function applySystemMessageStyle(style) {
  // 创建或更新style标签
  let styleElement = document.getElementById('dynamic-sys-msg-style')
  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = 'dynamic-sys-msg-style'
    document.head.appendChild(styleElement)
  }

  styleElement.textContent = `
    .sys_msg {
      color: ${style.textColor} !important;
      background-color: ${style.backgroundColor} !important;
      border-radius: ${style.borderRadius || '8px'} !important;
      padding: ${style.padding || '2px 6px'} !important;
      width: auto;
    }
  `
}

async function fetchNoticeContent() {
  toastr.info('新公告')
  try {
    const response = await fetch(`${SRC_URL}/notice`)
    if (!response.ok) throw new Error('获取公告失败')
    const resp = await response.json()
    NoticeContent = resp.text || '欢迎加入聊天室！你可以点击右上角的设置按钮自定义你的用户名和头像。<br><h4 class="sys_msg">信息支持html标签哦~</h4>'
    NoticeTime = resp.time
    const welcomeMessage = {
      username: '系统',
      avatar: 'https://ui-avatars.com/api/?name=System&background=0D8ABC',
      text: '<span class="gg">[公告] </span>' + NoticeContent,
      timestamp: NoticeTime,
      id: 'sys_msg_0',
    }
    displayMessage(welcomeMessage)
  } catch (error) {
    console.log('获取公告失败:', error)
    toastr.error('获取公告失败')
    const welcomeMessage = {
      username: '系统',
      avatar: 'https://ui-avatars.com/api/?name=System&background=0D8ABC',
      text: '<span class="gg">[公告] </span>' + NoticeContent,
      timestamp: NoticeTime,
      id: 'sys_msg_0',
    }
    displayMessage(welcomeMessage)
  }
}

// 渲染在线用户
function renderOnlineUsers(users) {
  const userList = document.querySelector('.user-list')
  userList.innerHTML = ''

  // 使用登录用户信息
  const myUsername = currentUser ? currentUser.username : userConfig.username
  const myAvatar = currentUser ? currentUser.avatar : userConfig.avatar

  // 去重：按用户名去重
  const uniqueUsers = []
  const seenUsernames = new Set()
  
  users.forEach(user => {
    if (!seenUsernames.has(user.username)) {
      seenUsernames.add(user.username)
      uniqueUsers.push(user)
    }
  })

  // 添加当前用户（如果不在列表中）
  if (!seenUsernames.has(myUsername)) {
    const currentUserItem = document.createElement('div')
    currentUserItem.className = 'user-item'
    currentUserItem.innerHTML = `
      <img src="${myAvatar}" alt="${myUsername}">
      <span>${myUsername} (我)</span>
    `
    userList.appendChild(currentUserItem)
  }

  // 添加其他在线用户
  uniqueUsers
    .filter((user) => user.username !== myUsername)
    .forEach((user) => {
      const userItem = document.createElement('div')
      userItem.className = 'user-item'
      userItem.innerHTML = `
        <img src="${user.avatar}" alt="${user.username}">
        <span>${user.username}</span>
      `
      userList.appendChild(userItem)
    })
}

// WebSocket连接
function setupWebSocket() {
  // 构建 WebSocket URL
  let wsUrl
  if (electron_build) {
    // Electron 构建时使用配置的 URL
    const protocol = SRC_URL.startsWith('https') ? 'wss:' : 'ws:'
    const host = SRC_URL.replace(/^https?:\/\//, '')
    wsUrl = `${protocol}//${host}`
  } else {
    // 网页端使用当前地址
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    wsUrl = `${protocol}//${window.location.host}`
  }
  
  const ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    // WebSocket连接成功
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    if (data.type === 'new-message') {
      fetchMessages()
    } else if (data.type === 'new-gg') {
      fetchNoticeContent()
    }
  }

  ws.onerror = (error) => {
    // WebSocket错误，静默处理
  }

  ws.onclose = () => {
    // WebSocket关闭，3秒后重连
    setTimeout(setupWebSocket, 3000)
  }

  return ws
}

document.getElementById('send-btn').addEventListener('click', sendMessage)

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage()
  }
})

document.getElementById('settings-btn').addEventListener('click', () => {
  settingsM.style.display = 'flex'
  // lastContent = avatarInput.value.trim()
  avatarInput.value = userConfig.avatar
  userInput.value = userConfig.username
  lastContent.push(userInput.value.trim())
  lastContent.push(avatarInput.value.trim())
  if (lastContent[1] != `https://ui-avatars.com/api/?name=${lastContent[0]}&background=random` && lastContent[1] != '') {
    autoChange = false
  }
})

document.querySelector('.close-btn').addEventListener('click', () => {
  settingsM.style.display = 'none'
})

document.getElementById('save-settings').addEventListener('click', saveSettings)

avatarInput.addEventListener('input', () => {
  autoChange = false
  avatarPreview.src = avatarInput.value || `https://ui-avatars.com/api/?name=${encodeURIComponent(userInput.value || 'User')}&background=random`
})
userInput.addEventListener('input', () => {
  if (autoChange || lastContent[1] === '') {
    avatarInput.value = `https://ui-avatars.com/api/?name=${encodeURIComponent(userInput.value || 'User')}&background=random`
  }
  avatarPreview.src = avatarInput.value || `https://ui-avatars.com/api/?name=${encodeURIComponent(userInput.value || 'User')}&background=random`
})
fileInput.addEventListener('change', handleFileSelect)

avatarFileInput.addEventListener('change', function () {
  if (this.files.length > 0) {
    const file = this.files[0]
    avatarFileName.textContent = file.name

    const reader = new FileReader()
    reader.onload = function (e) {
      avatarPreview.src = e.target.result
    }
    reader.readAsDataURL(file)
  }
})

// 检查登录状态
async function checkAuth() {
  if (!userToken) {
    window.location.href = '/login.html'
    return false
  }

  try {
    const response = await fetch(`${SRC_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })

    if (!response.ok) {
      localStorage.removeItem('userToken')
      localStorage.removeItem('currentUser')
      window.location.href = '/login.html'
      return false
    }

    const user = await response.json()
    currentUser = user
    localStorage.setItem('currentUser', JSON.stringify(user))
    return true
  } catch (error) {
    console.error('验证失败:', error)
    window.location.href = '/login.html'
    return false
  }
}

// 获取所有用户列表
async function fetchAllUsers() {
  try {
    const response = await fetch(`${SRC_URL}/users/list`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    if (response.ok) {
      const data = await response.json()
      allUsers = data.users
    }
  } catch (error) {
    console.error('获取用户列表失败:', error)
  }
}

// 获取通知
async function fetchNotifications() {
  try {
    const response = await fetch(`${SRC_URL}/notifications`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    if (response.ok) {
      const data = await response.json()
      notifications = data.notifications
      updateNotificationBadge()
    }
  } catch (error) {
    console.error('获取通知失败:', error)
  }
}

// 更新通知徽章
function updateNotificationBadge() {
  const unreadCount = notifications.filter((n) => !n.read).length
  const badge = document.getElementById('notification-badge')
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount
      badge.style.display = 'block'
    } else {
      badge.style.display = 'none'
    }
  }
}

// 初始化
async function init() {
  const isAuthenticated = await checkAuth()
  if (!isAuthenticated) return

  // 初始化用户配置（会自动使用currentUser如果存在）
  initUserConfig()
  initLocalMessages()
  fetchRoomConfig()
  fetchBadges()
  fetchAllUsers()
  fetchNotifications()
  fetchMessages()
  fetchNoticeContent()
  fetchOnlineUsers()
  setupWebSocket()

  // 定时获取通知
  setInterval(fetchNotifications, 30000)
}

init()

// 每30秒更新在线用户
setInterval(fetchOnlineUsers, 30000)

// 监听消息容器滚动，显示/隐藏回到底部按钮
messagesContainer.addEventListener('scroll', () => {
  const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100
  
  if (isAtBottom) {
    scrollToBottomBtn.style.display = 'none'
  } else {
    scrollToBottomBtn.style.display = 'flex'
  }
})

// 回到底部按钮点击事件
scrollToBottomBtn.addEventListener('click', () => {
  messagesContainer.scrollTo({
    top: messagesContainer.scrollHeight,
    behavior: 'smooth'
  })
})

// 右键菜单事件监听
document.querySelectorAll('.context-menu-item').forEach((item) => {
  item.addEventListener('click', () => {
    const action = item.dataset.action
    handleContextMenuAction(action)
  })
})

// 点击其他地方关闭菜单
document.addEventListener('click', hideContextMenu)

// 检查是否为管理员
const adminToken = localStorage.getItem('adminToken')
if (adminToken) {
  // 简单验证，实际应该调用API验证
  isAdmin = true
}

// 引用预览关闭按钮
document.getElementById('quote-preview-close').addEventListener('click', cancelQuote)

// 通知中心按钮
document.getElementById('notification-btn').addEventListener('click', () => {
  const panel = document.getElementById('notification-panel')
  panel.classList.toggle('active')
  // 关闭私聊面板
  document.getElementById('private-chat-panel').classList.remove('active')
  renderNotifications()
})

document.getElementById('notification-close').addEventListener('click', () => {
  document.getElementById('notification-panel').classList.remove('active')
})

// 私聊按钮
document.getElementById('private-chat-btn').addEventListener('click', () => {
  const panel = document.getElementById('private-chat-panel')
  panel.classList.toggle('active')
  // 关闭通知面板
  document.getElementById('notification-panel').classList.remove('active')
  // TODO: 加载私聊会话列表
})

document.getElementById('private-close').addEventListener('click', () => {
  document.getElementById('private-chat-panel').classList.remove('active')
})

// 登出按钮
document.getElementById('logout-btn').addEventListener('click', async () => {
  if (!confirm('确定要登出吗？')) return

  try {
    await fetch(`${SRC_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    })
  } catch (error) {
    console.error('登出错误:', error)
  }

  localStorage.removeItem('userToken')
  localStorage.removeItem('currentUser')
  window.location.href = '/login.html'
})

// 渲染通知列表
function renderNotifications() {
  const container = document.getElementById('notification-list')

  if (notifications.length === 0) {
    container.innerHTML = '<p class="empty-message">暂无通知</p>'
    return
  }

  container.innerHTML = ''
  notifications.reverse().forEach((notif) => {
    const item = document.createElement('div')
    item.className = `notification-item ${notif.read ? '' : 'unread'}`

    let iconClass = 'mention'
    let iconSymbol = '@'
    let title = '提及了你'

    if (notif.type === 'reply') {
      iconClass = 'reply'
      iconSymbol = '↩️'
      title = '回复了你'
    } else if (notif.type === 'private_message') {
      iconClass = 'private'
      iconSymbol = '💬'
      title = '发来私聊'
    }

    const time = new Date(notif.timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

    item.innerHTML = `
      <div class="notification-header">
        <div class="notification-icon ${iconClass}">${iconSymbol}</div>
        <div class="notification-title">${notif.data.fromUsername} ${title}</div>
        <div class="notification-time">${time}</div>
      </div>
      <div class="notification-content">${notif.data.text || ''}</div>
    `

    item.addEventListener('click', () => {
      // 标记为已读
      markNotificationAsRead(notif.id)
      
      // 关闭通知面板
      document.getElementById('notification-panel').classList.remove('active')
      
      // 跳转到对应消息
      if (notif.data.messageId) {
        scrollToMessage(notif.data.messageId)
      }
    })

    container.appendChild(item)
  })
}

// 标记通知为已读
async function markNotificationAsRead(notificationId) {
  try {
    await fetch(`${SRC_URL}/notifications/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ notificationIds: [notificationId] }),
    })

    // 更新本地状态
    const notif = notifications.find((n) => n.id === notificationId)
    if (notif) {
      notif.read = true
      updateNotificationBadge()
      renderNotifications()
    }
  } catch (error) {
    console.error('标记通知失败:', error)
  }
}

///////////////////////////////////////////////////////
//
// 屑王文星不要闹了😡，你让你的群U们都跟着你丢脸😡，
// 从现在开始，网费清零😡，什么流量都没有，什么游戏都不许玩😡
//
///////////////////////////////////////////////////////
