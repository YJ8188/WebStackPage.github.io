/**
 * 移动端ERP - 日常笔记模块
 */

window.NotesModule = {
  name: 'notes',
  keyword: '',
  pinnedOnly: false,
  currentPage: 1,
  pageSize: 20,
  notes: [],
  hasMore: true,
  eventsBound: false,
  syncEventsBound: false,
  realtimeChannel: null,
  realtimeRefreshTimer: null,
  realtimeUserId: '',

  async init(params = {}) {
    this.keyword = String(params?.keyword || this.keyword || '').trim();
    this.pinnedOnly = String(params?.pinned || '').trim() === '1' ? true : !!this.pinnedOnly;
    this.currentPage = 1;
    this.notes = [];
    this.hasMore = true;

    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
    if (!this.syncEventsBound) {
      this.bindSyncEvents();
      this.syncEventsBound = true;
    }

    this.startRealtimeSync();
    this.applyPinnedSwitch();
    const input = document.getElementById('notesSearchInput');
    if (input) {
      input.value = this.keyword;
    }
    await this.loadNotes();
  },

  bindEvents() {
    const searchInput = document.getElementById('notesSearchInput');
    if (searchInput) {
      const onSearch = window.Utils.debounce(async () => {
        this.keyword = String(searchInput.value || '').trim();
        this.currentPage = 1;
        this.notes = [];
        this.hasMore = true;
        await this.loadNotes();
      }, 260);
      searchInput.addEventListener('input', onSearch);
    }

    document.getElementById('notesAddBtn')?.addEventListener('click', () => {
      this.showNoteEditor(null);
    });

    const pinnedSwitch = document.getElementById('notesPinnedOnlySwitch');
    if (pinnedSwitch) {
      pinnedSwitch.addEventListener('change', async () => {
        this.pinnedOnly = !!pinnedSwitch.checked;
        this.currentPage = 1;
        this.notes = [];
        this.hasMore = true;
        await this.loadNotes();
      });
    }

    const content = document.getElementById('notesContent');
    if (content) {
      content.addEventListener('scroll', window.Utils.throttle(() => {
        if (content.scrollHeight - content.scrollTop - content.clientHeight < 100) {
          this.loadMore();
        }
      }, 260));

      content.addEventListener('click', (event) => {
        const pinBtn = event.target.closest('[data-action="toggle-pin"]');
        if (pinBtn && content.contains(pinBtn)) {
          const noteId = String(pinBtn.dataset.id || '').trim();
          const note = this.notes.find(item => String(item?.id || '') === noteId);
          if (note) {
            this.togglePinned(note);
          }
          return;
        }

        const delBtn = event.target.closest('[data-action="delete-note"]');
        if (delBtn && content.contains(delBtn)) {
          const noteId = String(delBtn.dataset.id || '').trim();
          this.deleteNote(noteId);
          return;
        }

        const card = event.target.closest('.notes-record-card');
        if (!card || !content.contains(card)) return;
        const noteId = String(card.dataset.id || '').trim();
        const note = this.notes.find(item => String(item?.id || '') === noteId);
        if (note) {
          this.showNoteEditor(note);
        }
      });
    }
  },

  bindSyncEvents() {
    window.addEventListener('focus', () => this.scheduleRealtimeRefresh('focus'));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.scheduleRealtimeRefresh('visibility');
      }
    });
    if (window.EventBus?.on) {
      window.EventBus.on('network:online', () => this.scheduleRealtimeRefresh('network-online'));
      window.EventBus.on('auth:changed', () => {
        this.startRealtimeSync();
        this.scheduleRealtimeRefresh('auth-changed');
      });
    }
  },

  isPageActive() {
    const page = document.getElementById('notesPage');
    return !!page && !page.classList.contains('hidden');
  },

  scheduleRealtimeRefresh() {
    if (this.realtimeRefreshTimer) {
      clearTimeout(this.realtimeRefreshTimer);
      this.realtimeRefreshTimer = null;
    }
    this.realtimeRefreshTimer = setTimeout(async () => {
      if (!this.isPageActive()) return;
      this.currentPage = 1;
      this.notes = [];
      this.hasMore = true;
      await this.loadNotes();
    }, 260);
  },

  stopRealtimeSync() {
    if (this.realtimeRefreshTimer) {
      clearTimeout(this.realtimeRefreshTimer);
      this.realtimeRefreshTimer = null;
    }

    const client = window.supabaseClient || window.supabase;
    if (this.realtimeChannel) {
      try {
        if (client && typeof client.removeChannel === 'function') {
          client.removeChannel(this.realtimeChannel);
        } else if (typeof this.realtimeChannel.unsubscribe === 'function') {
          this.realtimeChannel.unsubscribe();
        }
      } catch (error) {
        console.warn('停止笔记 realtime 订阅失败:', error);
      }
    }

    this.realtimeChannel = null;
    this.realtimeUserId = '';
  },

  startRealtimeSync() {
    const userId = String(window.MobileERP?.getCurrentUser?.()?.id || '').trim();
    if (this.realtimeChannel && this.realtimeUserId === userId) return;
    this.stopRealtimeSync();

    const client = window.supabaseClient || window.supabase;
    if (!client || typeof client.channel !== 'function') return;

    const channelName = `mobile-erp-notes-${userId || 'guest'}`;
    const refreshIfNeeded = payload => {
      const row = payload?.new || payload?.old || {};
      const rowUserId = String(row?.user_id || '').trim();
      if (userId && rowUserId && rowUserId !== String(userId)) {
        return;
      }
      this.scheduleRealtimeRefresh('realtime');
    };

    this.realtimeChannel = client
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'erp_notes' }, refreshIfNeeded)
      .subscribe();
    this.realtimeUserId = userId;
  },

  applyPinnedSwitch() {
    const pinnedSwitch = document.getElementById('notesPinnedOnlySwitch');
    if (pinnedSwitch) {
      pinnedSwitch.checked = !!this.pinnedOnly;
    }
  },

  escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  buildHtmlFromPlainText(text) {
    const normalized = String(text ?? '').replace(/\r\n/g, '\n');
    if (!normalized.trim()) {
      return '';
    }
    return normalized
      .split('\n')
      .map(line => {
        const safeLine = this.escapeHtml(line).replace(/ {2}/g, ' &nbsp;');
        return safeLine ? `<p>${safeLine}</p>` : '<p><br></p>';
      })
      .join('');
  },

  resolveEditedContentHtml(note, nextContent) {
    const nextText = String(nextContent ?? '').replace(/\r\n/g, '\n').trim();
    const beforeText = String(note?.content_text || '').replace(/\r\n/g, '\n').trim();
    const beforeHtml = String(note?.content_html || '').trim();
    if (beforeHtml && nextText === beforeText) {
      return beforeHtml;
    }
    return this.buildHtmlFromPlainText(nextText);
  },

  getPreviewText(note) {
    const contentText = String(note?.content_text || '').trim();
    if (contentText) return contentText.slice(0, 90);
    const htmlText = String(note?.content_html || '').replace(/<[^>]+>/g, ' ').trim();
    return htmlText.slice(0, 90) || '无内容';
  },

  async loadNotes() {
    try {
      window.Loading.show('加载笔记...');
      const offset = (this.currentPage - 1) * this.pageSize;
      const rows = await window.API.getNotes({
        keyword: this.keyword,
        pinnedOnly: this.pinnedOnly,
        limit: this.pageSize,
        offset
      });

      if (rows.length < this.pageSize) {
        this.hasMore = false;
      }
      this.notes = this.currentPage === 1 ? rows : [...this.notes, ...rows];
      this.render();
      window.Loading.hide();
    } catch (error) {
      window.Loading.hide();
      console.error('加载笔记失败:', error);
      window.Toast.error(error?.message || '加载笔记失败');
    }
  },

  async loadMore() {
    if (!this.hasMore) return;
    this.currentPage += 1;
    await this.loadNotes();
  },

  render() {
    const container = document.getElementById('notesContent');
    if (!container) return;

    if (!Array.isArray(this.notes) || this.notes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa fa-pencil-square-o"></i></div>
          <div class="empty-text">暂无日常笔记</div>
        </div>
      `;
      return;
    }

    const cards = this.notes.map(note => {
      const idText = this.escapeHtml(note?.id);
      const title = this.escapeHtml(String(note?.title || '').trim() || '未命名笔记');
      const preview = this.escapeHtml(this.getPreviewText(note));
      const timeText = this.escapeHtml(window.Utils.formatDate(note?.updated_at || note?.created_at, 'YYYY/MM/DD HH:mm:ss'));
      const pinned = !!note?.is_pinned;
      return `
        <div class="notes-record-card" data-id="${idText}"
          style="margin:8px 12px;padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="font-size:14px;font-weight:600;color:#0f172a;">${title}</div>
            ${pinned ? '<span style="font-size:11px;color:#d97706;background:#fffbeb;border:1px solid #fde68a;border-radius:999px;padding:2px 8px;">置顶</span>' : ''}
          </div>
          <div style="margin-top:6px;font-size:12px;color:#475569;line-height:1.45;">${preview}</div>
          <div style="margin-top:6px;font-size:12px;color:#94a3b8;">${timeText}</div>
          <div style="margin-top:8px;display:flex;gap:8px;">
            <button type="button" data-action="toggle-pin" data-id="${idText}"
              style="height:28px;padding:0 10px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#334155;font-size:12px;">
              ${pinned ? '取消置顶' : '置顶'}
            </button>
            <button type="button" data-action="delete-note" data-id="${idText}"
              style="height:28px;padding:0 10px;border:1px solid #fecaca;border-radius:8px;background:#fff;color:#dc2626;font-size:12px;">
              删除
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = cards;
  },

  async showNoteEditor(note = null) {
    const isEdit = !!note?.id;
    const title = this.escapeHtml(String(note?.title || ''));
    const content = this.escapeHtml(String(note?.content_text || '').trim());
    const pinnedValue = note?.is_pinned ? '1' : '0';

    await window.Modal.show({
      title: isEdit ? '编辑笔记' : '新建笔记',
      confirmText: '保存',
      cancelText: '取消',
      content: `
        <div style="text-align:left;">
          <div style="margin-bottom:10px;">
            <div style="margin-bottom:6px;color:#475569;font-size:12px;">标题</div>
            <input id="mobileNoteTitleInput" type="text" maxlength="80" value="${title}" placeholder="输入标题"
              style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;box-sizing:border-box;" />
          </div>
          <div style="margin-bottom:10px;">
            <div style="margin-bottom:6px;color:#475569;font-size:12px;">内容 <span style="color:#dc2626;">*</span></div>
            <textarea id="mobileNoteContentInput" rows="5" placeholder="输入日常笔记内容"
              style="width:100%;border:1px solid #d9d9d9;border-radius:8px;padding:8px 10px;resize:none;box-sizing:border-box;">${content}</textarea>
          </div>
          <div>
            <div style="margin-bottom:6px;color:#475569;font-size:12px;">置顶</div>
            <select id="mobileNotePinnedInput" style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;box-sizing:border-box;">
              <option value="0" ${pinnedValue === '0' ? 'selected' : ''}>否</option>
              <option value="1" ${pinnedValue === '1' ? 'selected' : ''}>是</option>
            </select>
          </div>
        </div>
      `,
      onConfirm: async () => {
        const nextTitle = String(document.getElementById('mobileNoteTitleInput')?.value || '').trim();
        const nextContent = String(document.getElementById('mobileNoteContentInput')?.value || '').trim();
        const nextPinned = String(document.getElementById('mobileNotePinnedInput')?.value || '0') === '1';

        if (!nextTitle && !nextContent) {
          window.Toast.error('标题或内容至少填写一项');
          return false;
        }

        if (isEdit) {
          const nextHtml = this.resolveEditedContentHtml(note, nextContent);
          await window.API.updateNote(note.id, {
            title: nextTitle,
            content_text: nextContent,
            content_html: nextHtml,
            is_pinned: nextPinned
          });
        } else {
          const nextHtml = this.buildHtmlFromPlainText(nextContent);
          await window.API.createNote({
            title: nextTitle,
            content_text: nextContent,
            content_html: nextHtml,
            is_pinned: nextPinned
          });
        }

        window.Toast.success('笔记已保存');
        this.currentPage = 1;
        this.notes = [];
        this.hasMore = true;
        await this.loadNotes();
        return true;
      }
    });
  },

  async togglePinned(note) {
    try {
      await window.API.updateNote(note.id, {
        is_pinned: !note.is_pinned
      });
      this.currentPage = 1;
      this.notes = [];
      this.hasMore = true;
      await this.loadNotes();
    } catch (error) {
      console.error('更新置顶失败:', error);
      window.Toast.error(error?.message || '更新置顶失败');
    }
  },

  async deleteNote(noteId) {
    if (!noteId) return;
    const confirmed = await window.Modal.confirm('确认删除这条笔记吗？', '删除笔记');
    if (!confirmed) return;
    try {
      await window.API.deleteNote(noteId);
      window.Toast.success('已删除');
      this.currentPage = 1;
      this.notes = [];
      this.hasMore = true;
      await this.loadNotes();
    } catch (error) {
      console.error('删除笔记失败:', error);
      window.Toast.error(error?.message || '删除笔记失败');
    }
  }
};
