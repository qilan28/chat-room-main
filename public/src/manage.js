// 文件名: manage.js
// 描述：管理面板逻辑
// 版本: 1.0.0
// 作者: woshimaniubi8
// 日期: 2025-08-09

const messagesBody = document.getElementById('messages-body')
const searchInput = document.getElementById('search-input')
const filterButtons = document.querySelectorAll('.filter-btn')
const editModal = document.getElementById('edit-modal')
const noticeModal = document.getElementById('notice-modal')
const deleteModal = document.getElementById('delete-modal')
const roomSettingsModal = document.getElementById('room-settings-modal')
const adminSettingsModal = document.getElementById('admin-settings-modal')
const totalMessagesEl = document.getElementById('total-messages')
const activeUsersEl = document.getElementById('active-users')
const totalFujianEl = document.getElementById('total-attachments')

// 状态
let currentFilter = 'all'
let messages = []
let notices = {}
let roomConfig = {}
let currentEditId = null
let currentDeleteId = null
let adminToken = localStorage.getItem('adminToken') || ''
let adminUsername = localStorage.getItem('adminUsername') || ''

// 初始化
function init() {
  // 检查管理员登录状态
  if (!adminToken) {
    toastr.error('请先登录管理员账号')
    setTimeout(() => {
      window.location.href = '/admin-login.html'
    }, 1500)
    return
  }

  fetchMessages()
  fetchnotice()
  fetchRoomConfig()
  setupEventListeners()
}

// 获取消息数据
async function fetchMessages() {
  try {
    const response = await fetch('/messages')
    if (!response.ok) throw new Error('获取消息失败')

    messages = await response.json()
    renderMessages(messages)
    updateStatistics(messages)
  } catch (error) {
    console.error('获取消息失败:', error)
    //alert('无法加载消息数据')
    toastr.error('无法加载消息数据')
  }
}

// 更新统计信息
function updateStatistics(messages) {
  // 消息总数
  totalMessagesEl.textContent = messages.length

  // 活跃用户数（最近5分钟有活动的用户）
  const activeThreshold = Date.now() - 5 * 60 * 1000
  const activeUsers = new Set()

  messages.forEach((msg) => {
    const msgTime = new Date(msg.timestamp).getTime()
    if (msgTime > activeThreshold) {
      activeUsers.add(msg.username)
    }
  })

  activeUsersEl.textContent = activeUsers.size

  // 附件总数
  const totalFujian = messages.reduce((total, msg) => {
    return total + (msg.attachments ? msg.attachments.length : 0)
  }, 0)

  totalFujianEl.textContent = totalFujian
}

// 渲染消息列表
function renderMessages(messagesToRender) {
  messagesBody.innerHTML = ''

  if (messagesToRender.length === 0) {
    messagesBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px 20px;">
                        <i class="fas fa-inbox" style="font-size: 3rem; color: #dee2e6; margin-bottom: 15px;"></i>
                        <p>没有找到消息</p>
                    </td>
                </tr>
            `
    return
  }

  messagesToRender.forEach((message) => {
    const row = document.createElement('tr')

    // 格式化时间
    const date = new Date(message.timestamp)
    const timeString = date.toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

    // 附件信息
    let attachmentsInfo = ''
    if (message.attachments && message.attachments.length > 0) {
      attachmentsInfo = `<span class="attachment-badge">
                    <i class="fas fa-paperclip"></i> ${message.attachments.length}
                </span>`
    }

    // 消息预览（限制长度）
    let messagePreview = message.text || ''
    if (messagePreview.length > 100) {
      messagePreview = messagePreview.substring(0, 100) + '...'
    }

    row.innerHTML = `
                <td>
                    <div class="user-cell">
                        <img src="${message.avatar}" alt="${message.username}" class="user-avatar">
                        <span>${message.username}</span>
                    </div>
                </td>
                <td>
                    <div class="message-content">
                        <div class="message-preview">${messagePreview}</div>
                        ${attachmentsInfo}
                    </div>
                </td>
                <td>${timeString}</td>
                <td>${message.attachments ? message.attachments.length : 0}</td>
                <td class="actions-cell">
                    <button class="action-btn edit-btn" data-id="${message.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" data-id="${message.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `

    messagesBody.appendChild(row)
  })
  document.querySelectorAll('.edit-btn')[0].addEventListener('click', (e) => {})

  document.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const messageId = e.currentTarget.dataset.id
      openEditModal(messageId)
    })
  })

  document.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const messageId = e.currentTarget.dataset.id
      openDeleteModal(messageId)
    })
  })
}
async function fetchnotice() {
  try {
    const response = await fetch(`/notice`)
    if (!response.ok) throw new Error('获取公告失败')
    const resp = await response.json()
    notices = resp
  } catch (error) {
    console.log('获取公告失败:', error)
    toastr.error('获取公告失败')
  }
}

async function fetchRoomConfig() {
  try {
    const response = await fetch('/config')
    if (!response.ok) throw new Error('获取配置失败')
    roomConfig = await response.json()
  } catch (error) {
    console.error('获取配置失败:', error)
    toastr.error('获取配置失败')
  }
}
function getFileTypeIcon(ext) {
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
    default: { icon: 'file', color: '#95a5a6' },
  }

  return icons[ext] || icons.default
}

function openNoticeModal() {
  document.getElementById('edit-noticecontent').value = notices.text
  const noticepreviewContainer = document.getElementById('noticepreview-container')
  const timeInput = document.getElementById('edit-noticetimestamp')
  timeInput.value = new Date(notices.time).toLocaleString()
  noticepreviewContainer.innerHTML = '<span class="gg">[公告] </span>'
  noticepreviewContainer.innerHTML += notices.text.replace(/<br\s*\/?>/gi, '<br>')
  noticeModal.style.display = 'flex'
}

function openRoomSettingsModal() {
  document.getElementById('room-name').value = roomConfig.roomName || '公共聊天室'
  document.getElementById('welcome-message').value = roomConfig.welcomeMessage || '欢迎来到聊天室！'
  document.getElementById('max-message-length').value = roomConfig.maxMessageLength || 5000

  // 加载系统消息样式
  const sysStyle = roomConfig.systemMessageStyle || {
    backgroundColor: 'rgb(27, 128, 223)',
    textColor: 'pink',
  }

  // 转换RGB为hex颜色
  const bgColor = rgbToHex(sysStyle.backgroundColor)
  const textColor = rgbToHex(sysStyle.textColor)

  document.getElementById('sys-bg-color').value = bgColor
  document.getElementById('sys-text-color').value = textColor

  // 更新预览
  updateSysMessagePreview()

  roomSettingsModal.style.display = 'flex'
}

// RGB转换为Hex
function rgbToHex(rgb) {
  if (rgb.startsWith('#')) return rgb

  const result = rgb.match(/\d+/g)
  if (!result || result.length < 3) return '#1b80df'

  const r = parseInt(result[0])
  const g = parseInt(result[1])
  const b = parseInt(result[2])

  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

// Hex转换为RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return 'rgb(27, 128, 223)'

  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)

  return `rgb(${r}, ${g}, ${b})`
}

// 更新系统消息预览
function updateSysMessagePreview() {
  const bgColor = document.getElementById('sys-bg-color').value
  const textColor = document.getElementById('sys-text-color').value
  const preview = document.getElementById('sys-msg-preview')

  preview.style.backgroundColor = bgColor
  preview.style.color = textColor
}

function openAdminSettingsModal() {
  document.getElementById('current-admin').value = adminUsername
  document.getElementById('old-password').value = ''
  document.getElementById('new-password').value = ''
  document.getElementById('confirm-password').value = ''
  adminSettingsModal.style.display = 'flex'
}

// 打开编辑模态框
function openEditModal(messageId) {
  const message = messages.find((msg) => msg.id === messageId)
  if (!message) return

  currentEditId = messageId

  // 填充数据
  document.getElementById('edit-username').value = message.username
  document.getElementById('edit-timestamp').value = new Date(message.timestamp).toLocaleString()
  document.getElementById('edit-msgid').value = message.id
  document.getElementById('edit-content').value = message.text || ''

  // 渲染附件
  const attachmentsContainer = document.getElementById('attachments-container')
  attachmentsContainer.innerHTML = ''

  if (message.attachments && message.attachments.length > 0) {
    message.attachments.forEach((attachment) => {
      const attachmentEl = document.createElement('div')
      attachmentEl.className = 'attachment-item'

      if (attachment.type === 'image') {
        attachmentEl.innerHTML = `
                        <img src="${attachment.url}" alt="${attachment.name}" style="max-width: 130px; max-height: 130px; border-radius: 5px; cursor: pointer; margin-right: 10px;" onclick="window.open('${attachment.url}', '_blank')"></img>
                       
                    `
      } else if (attachment.type === 'video') {
        attachmentEl.innerHTML = `
                        <video src="${attachment.url}" alt="${attachment.name}" style="max-width: 130px; max-height: 130px; border-radius: 5px; margin-right: 10px;" controls></video>
                        
                    `
      } else if (attachment.type === 'audio') {
        attachmentEl.innerHTML = `
                        <audio src="${attachment.url}" style="max-width: 130px; max-height: 230px; border-radius: 5px; margin-right: 10px;" controls></audio>
                       
                    `
      } else {
        const fileType = getFileTypeIcon(attachment.name.split('.').pop())
        attachmentEl.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
                       <i class="fas fa-${fileType.icon}" style="margin-right: 10px; color: ${fileType.color};"></i>
                       <a href="${attachment.url}" target="_blank" ">
                        <p>${attachment.name}</p>
                        </a>
                        </div>
                    `
      }

      attachmentsContainer.appendChild(attachmentEl)
    })
  } else {
    attachmentsContainer.innerHTML = '<p>此消息没有附件</p>'
  }

  // 显示模态框
  editModal.style.display = 'flex'
}

// 打开删除模态框
function openDeleteModal(messageId) {
  const message = messages.find((msg) => msg.id === messageId)
  if (!message) return

  currentDeleteId = messageId

  // 显示消息预览
  let previewText = message.text || ''
  if (previewText.length > 100) {
    previewText = previewText.substring(0, 100) + '...'
  }

  document.getElementById('delete-message-preview').textContent = previewText

  // 显示模态框
  deleteModal.style.display = 'flex'
}

async function updateNotice(contents) {
  try {
    const formData = {
      text: contents,
      time: new Date().toISOString(),
    }
    const response = await fetch(`/notice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    })

    if (!response.ok) throw new Error('更新公告失败')
    notices = formData
  } catch (error) {
    console.error('更新公告失败:', error)
    toastr.error('更新公告失败，请重试')
    return
  }
}

async function saveRoomSettings() {
  const roomName = document.getElementById('room-name').value.trim()
  const welcomeMessage = document.getElementById('welcome-message').value.trim()
  const maxMessageLength = parseInt(document.getElementById('max-message-length').value)

  if (!roomName) {
    toastr.error('聊天室名称不能为空')
    return
  }

  if (maxMessageLength < 100 || maxMessageLength > 10000) {
    toastr.error('消息最大长度必须在10010000之间')
    return
  }

  // 获取系统消息样式
  const bgColorHex = document.getElementById('sys-bg-color').value
  const textColorHex = document.getElementById('sys-text-color').value

  const systemMessageStyle = {
    backgroundColor: hexToRgb(bgColorHex),
    textColor: hexToRgb(textColorHex),
    borderRadius: '8px',
    padding: '2px 6px',
  }

  try {
    const response = await fetch('/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        roomName,
        welcomeMessage,
        maxMessageLength,
        systemMessageStyle,
      }),
    })

    const data = await response.json()

    if (response.ok && data.success) {
      roomConfig = data.config
      // 更新CSS变量
      updateSystemMessageCSS(systemMessageStyle)
      closeModal(roomSettingsModal)
      toastr.success('聊天室设置已更新')
      // 刷新页面以显示新名称
      location.reload()
    } else {
      toastr.error(data.error || '保存失败')
    }
  } catch (error) {
    console.error('保存设置失败:', error)
    toastr.error('保存设置失败，请重试')
  }
}

// 更新系统消息CSS
function updateSystemMessageCSS(style) {
  const styleSheet = document.styleSheets[0]
  const rules = styleSheet.cssRules || styleSheet.rules

  // 查找.sys_msg规则
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].selectorText === '.sys_msg') {
      rules[i].style.backgroundColor = style.backgroundColor
      rules[i].style.color = style.textColor
      break
    }
  }
}

async function changeAdminPassword() {
  const oldPassword = document.getElementById('old-password').value.trim()
  const newPassword = document.getElementById('new-password').value.trim()
  const confirmPassword = document.getElementById('confirm-password').value.trim()

  if (!oldPassword || !newPassword || !confirmPassword) {
    toastr.error('请填写所有密码字段')
    return
  }

  if (newPassword !== confirmPassword) {
    toastr.error('两次输入的新密码不一致')
    return
  }

  if (newPassword.length < 6) {
    toastr.error('新密码长度不能少于6位')
    return
  }

  try {
    const response = await fetch('/admin/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        oldPassword,
        newPassword,
      }),
    })

    const data = await response.json()

    if (response.ok && data.success) {
      closeModal(adminSettingsModal)
      toastr.success('密码修改成功')
      document.getElementById('old-password').value = ''
      document.getElementById('new-password').value = ''
      document.getElementById('confirm-password').value = ''
    } else {
      toastr.error(data.error || '修改密码失败')
    }
  } catch (error) {
    console.error('修改密码失败:', error)
    toastr.error('修改密码失败，请重试')
  }
}

async function adminLogout() {
  try {
    await fetch('/admin/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    })

    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUsername')
    toastr.success('已退出登录')
    setTimeout(() => {
      window.location.href = '/admin-login.html'
    }, 1000)
  } catch (error) {
    console.error('退出失败:', error)
    toastr.error('退出失败')
  }
}

// 保存编辑
async function saveEdit() {
  if (!currentEditId) return

  let newText = document.getElementById('edit-content').value.trim()
  if (!newText) {
    newText = '.'
  }

  try {
    const response = await fetch(`/messages/${currentEditId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: newText }),
    })

    if (!response.ok) throw new Error('更新消息失败')

    const updatedMessage = await response.json()

    // 更新本地消息数据
    const index = messages.findIndex((msg) => msg.id === currentEditId)
    if (index !== -1) {
      messages[index] = updatedMessage
      renderMessages(messages)
    }

    closeModal(editModal)
    // alert('消息更新成功！');
    toastr.success('消息更新成功！')
  } catch (error) {
    console.error('更新消息失败:', error)
    //  alert('更新消息失败，请重试')
    toastr.error('更新消息失败，请重试')
  }
}

// 确认删除
async function confirmDelete() {
  if (!currentDeleteId) return

  try {
    const response = await fetch(`/messages/${currentDeleteId}`, {
      method: 'DELETE',
    })

    if (!response.ok) throw new Error('删除消息失败')

    // 更新本地消息数据
    messages = messages.filter((msg) => msg.id !== currentDeleteId)
    renderMessages(messages)
    updateStatistics(messages)

    closeModal(deleteModal)
    toastr.success('消息已成功删除！')
    // alert('消息已成功删除！')
  } catch (error) {
    console.error('删除消息失败:', error)
    // alert('删除消息失败，请重试')
    toastr.error('删除消息失败，请重试')
  }
}

// 关闭模态框
function closeModal(modal) {
  modal.style.display = 'none'
  currentEditId = null
  currentDeleteId = null
}

// 过滤消息
function filterMessages() {
  const searchTerm = searchInput.value.toLowerCase()

  let filtered = messages

  // 应用搜索过滤
  if (searchTerm) {
    filtered = filtered.filter((msg) => msg.text && msg.text.toLowerCase().includes(searchTerm))
  }

  // 应用类型过滤
  switch (currentFilter) {
    case 'text':
      filtered = filtered.filter((msg) => (!msg.attachments || msg.attachments.length === 0) && msg.text && msg.text.trim() !== '')
      break
    case 'media':
      filtered = filtered.filter((msg) => msg.attachments && msg.attachments.some((att) => ['image', 'video', 'audio'].includes(att.type)))
      break
    case 'attachments':
      filtered = filtered.filter((msg) => msg.attachments && msg.attachments.length > 0)
      break
    // 'all' 不进行过滤
  }

  renderMessages(filtered)
}

// 设置事件监听器
function setupEventListeners() {
  // 搜索框事件
  searchInput.addEventListener('input', filterMessages)

  // 过滤按钮事件
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      currentFilter = btn.dataset.filter
      filterMessages()
    })
  })

  // 模态框关闭事件
  document.querySelectorAll('.close-modal, #cancel-edit, #cancel-delete').forEach((el) => {
    el.addEventListener('click', () => {
      closeModal(editModal)
      closeModal(noticeModal)
      closeModal(deleteModal)
    })
  })

  document.getElementById('edit-noticecontent').addEventListener('input', () => {
    const noticeContent = document.getElementById('edit-noticecontent').value.trim()
    const noticepreviewContainer = document.getElementById('noticepreview-container')
    noticepreviewContainer.innerHTML = '<span class="gg">[公告] </span>'
    noticepreviewContainer.innerHTML += noticeContent.replace(/<br\s*\/?>/gi, '<br>')
  })

  document.getElementById('noticeDefalut').addEventListener('click', () => {
    document.getElementById('edit-noticecontent').value = '欢迎加入聊天室！你可以点击右上角的设置按钮自定义你的用户名和头像。<br><h4 class="sys_msg">信息支持html标签哦~</h4>'
    const noticepreviewContainer = document.getElementById('noticepreview-container')
    noticepreviewContainer.innerHTML =
      '<span class="gg">[公告] </span>' +
      document
        .getElementById('edit-noticecontent')
        .value.trim()
        .replace(/<br\s*\/?>/gi, '<br>')
  })

  // 保存编辑事件
  document.getElementById('save-edit').addEventListener('click', saveEdit)
  document.getElementById('save-noticeedit').addEventListener('click', () => {
    const noticeContent = document.getElementById('edit-noticecontent').value.trim()
    if (!noticeContent) {
      toastr.error('公告内容不能为空')
      return
    }

    updateNotice(noticeContent)
    closeModal(noticeModal)
    toastr.success('公告已更新')
  })

  // 确认删除事件
  document.getElementById('confirm-delete').addEventListener('click', confirmDelete)

  // 点击模态框外部关闭
  window.addEventListener('click', (e) => {
    if (e.target === editModal) closeModal(editModal)
    if (e.target === deleteModal) closeModal(deleteModal)
  })

  // 按ESC键关闭模态框
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(editModal)
      closeModal(deleteModal)
      closeModal(roomSettingsModal)
      closeModal(adminSettingsModal)
    }
  })

  // 聊天室设置事件
  document.getElementById('save-room-settings').addEventListener('click', saveRoomSettings)
  document.getElementById('cancel-room-settings').addEventListener('click', () => {
    closeModal(roomSettingsModal)
  })

  // 系统消息样式预览
  document.getElementById('sys-bg-color').addEventListener('input', updateSysMessagePreview)
  document.getElementById('sys-text-color').addEventListener('input', updateSysMessagePreview)

  // 管理员设置事件
  document.getElementById('save-admin-password').addEventListener('click', changeAdminPassword)
  document.getElementById('cancel-admin-settings').addEventListener('click', () => {
    closeModal(adminSettingsModal)
  })
  document.getElementById('logout-btn').addEventListener('click', () => {
    if (confirm('确定要退出登录吗？')) {
      adminLogout()
    }
  })
}

// 启动应用
init()
//})
