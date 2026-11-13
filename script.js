const CATEGORY_MAP = {
  uk: "英国",
  wuhan: "武汉",
  daily: "日常",
  travel: "旅行",
  food: "美食",
  campus: "校园"
};

let dbPosts = [];
let openEditPost = null;

function formatDate(date) {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function makeExcerpt(text) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 60 ? t.slice(0, 60) + "…" : t;
}

function toPost(row) {
  return {
    key: `db-${row.id}`,
    id: row.id,
    title: row.title,
    excerpt: row.excerpt || makeExcerpt(row.content),
    fullText: row.content,
    images: row.images || [],
    category: row.category,
    client_id: row.client_id,
    date: row.event_date
      ? row.event_date.replace(/-/g, ".")
      : formatDate(new Date(row.created_at))
  };
}

function getAllPosts() {
  return dbPosts.map(toPost);
}

let currentCategory = "all";
let carousel = {
  post: null,
  index: 0,
  track: null,
  dots: null,
  total: 0,
  startX: 0,
  currentX: 0,
  dragging: false,
  containerWidth: 0
};

function renderPosts() {
  const gallery = document.getElementById("gallery");
  const allPosts = getAllPosts();
  const filtered = currentCategory === "all"
    ? allPosts
    : allPosts.filter(p => p.category === currentCategory);

  if (!filtered.length) {
    gallery.innerHTML = `<div class="empty-state">还没有记录，点「+ 记录」写下第一段吧</div>`;
    return;
  }

  gallery.innerHTML = filtered.map(post => {
    const firstImg = post.images[0];
    const multi = post.images.length > 1;
    const imageHtml = firstImg
      ? `<img class="card-image" src="${firstImg}" alt="${escapeHtml(post.title)}" loading="lazy">`
      : `<div class="card-image-empty">&#9825;</div>`;
    return `
    <article class="card" data-key="${post.key}">
      <div class="card-image-wrap">
        ${imageHtml}
        ${multi ? `<span class="card-img-count">${post.images.length}图</span>` : ""}
      </div>
      <div class="card-body">
        <span class="card-tag">${CATEGORY_MAP[post.category] || ""}</span>
        <h3 class="card-title">${escapeHtml(post.title)}</h3>
        <p class="card-excerpt">${escapeHtml(post.excerpt)}</p>
        <span class="card-date">${post.date}</span>
        ${post.client_id === CLIENT_ID ? `
        <div class="card-actions">
          <button class="card-action" data-action="edit" data-key="${post.key}">编辑</button>
          <button class="card-action" data-action="delete" data-key="${post.key}">删除</button>
        </div>` : ""}
      </div>
    </article>
  `;
  }).join("");

  gallery.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => openModal(card.dataset.key));
  });

  gallery.querySelectorAll(".card-action").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.key.replace("db-", ""));
      if (btn.dataset.action === "edit") {
        const row = dbPosts.find(p => p.id === id);
        if (row && openEditPost) openEditPost(row);
      } else if (btn.dataset.action === "delete") {
        deletePost(id);
      }
    });
  });
}

async function deletePost(id) {
  if (!confirm("删除这条记录？")) return;
  const { data, error } = await supabaseClient
    .from("posts")
    .delete()
    .eq("id", id)
    .select("id");
  if (error || !data || !data.length) {
    console.error("删除记录失败:", error);
    alert("删除失败：" + (error ? error.message : "没有删除权限"));
    return;
  }
  dbPosts = dbPosts.filter(p => p.id !== id);
  renderPosts();
}

function openModal(key) {
  const post = getAllPosts().find(p => p.key === key);
  if (!post) return;

  carousel.post = post;
  carousel.index = 0;
  carousel.total = post.images.length;

  const track = document.getElementById("modal-track");
  const dots = document.getElementById("modal-dots");
  const carouselEl = document.getElementById("modal-carousel");

  carouselEl.style.display = post.images.length ? "" : "none";

  track.innerHTML = post.images.map(src =>
    `<div class="modal-slide"><img src="${src}" alt="${post.title}"></div>`
  ).join("");

  dots.innerHTML = post.images.length > 1
    ? post.images.map((_, i) => `<button class="modal-dot${i === 0 ? " active" : ""}" data-idx="${i}"></button>`).join("")
    : "";

  document.getElementById("modal-tag").textContent = CATEGORY_MAP[post.category] || "";
  document.getElementById("modal-title").textContent = post.title;
  document.getElementById("modal-text").textContent = post.fullText;

  document.getElementById("modal").classList.add("show");
  document.body.style.overflow = "hidden";

  requestAnimationFrame(() => {
    if (!post.images.length) return;
    track.classList.add("smooth");
    updateCarousel();
  });
}

function closeModal() {
  document.getElementById("modal").classList.remove("show");
  document.body.style.overflow = "";
  carousel.track = null;
}

function updateCarousel() {
  const track = document.getElementById("modal-track");
  if (!track) return;
  const w = track.parentElement.clientWidth;
  carousel.containerWidth = w;
  track.style.transform = `translateX(-${carousel.index * w}px)`;

  const dots = document.querySelectorAll(".modal-dot");
  dots.forEach((d, i) => d.classList.toggle("active", i === carousel.index));
}

function goSlide(dir) {
  const prev = carousel.index;
  carousel.index = (carousel.index + dir + carousel.total) % carousel.total;
  if (prev !== carousel.index) updateCarousel();
}

function goTo(idx) {
  carousel.index = Math.max(0, Math.min(carousel.total - 1, idx));
  updateCarousel();
}

function setupCarouselInteractions() {
  const track = document.getElementById("modal-track");

  document.getElementById("modal-prev").addEventListener("click", () => goSlide(-1));
  document.getElementById("modal-next").addEventListener("click", () => goSlide(1));

  document.getElementById("modal-dots").addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-dot")) {
      goTo(Number(e.target.dataset.idx));
    }
  });

  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("modal");
    if (!modal.classList.contains("show")) return;
    if (e.key === "Escape") { closeModal(); return; }
    if (carousel.total <= 1) return;
    if (e.key === "ArrowLeft") goSlide(-1);
    if (e.key === "ArrowRight") goSlide(1);
  });

  track.addEventListener("touchstart", (e) => {
    carousel.dragging = true;
    carousel.startX = e.touches[0].clientX;
    track.classList.remove("smooth");
  }, { passive: true });

  track.addEventListener("touchmove", (e) => {
    if (!carousel.dragging) return;
    carousel.currentX = e.touches[0].clientX;
    const diff = carousel.currentX - carousel.startX;
    const w = carousel.containerWidth || track.parentElement.clientWidth;
    track.style.transform = `translateX(calc(-${carousel.index * w}px + ${diff}px))`;
  }, { passive: true });

  track.addEventListener("touchend", () => {
    if (!carousel.dragging) return;
    carousel.dragging = false;
    const diff = carousel.currentX - carousel.startX;
    const threshold = 50;
    track.classList.add("smooth");
    if (diff < -threshold && carousel.index < carousel.total - 1) {
      carousel.index++;
    } else if (diff > threshold && carousel.index > 0) {
      carousel.index--;
    }
    updateCarousel();
  });

  window.addEventListener("resize", () => {
    const modal = document.getElementById("modal");
    if (modal.classList.contains("show")) updateCarousel();
  });
}

function setupModal() {
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
  });
  setupCarouselInteractions();
}

function switchView(view) {
  const showMessages = view === "messages";
  document.getElementById("view-gallery").hidden = showMessages;
  document.getElementById("view-messages").hidden = !showMessages;
  window.scrollTo({ top: 0 });
}

function setupMainNav() {
  const tabs = document.querySelectorAll(".main-tab");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      switchView(tab.dataset.view);
    });
  });
}

function setupNav() {
  const tabs = document.querySelectorAll(".nav-tab");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentCategory = tab.dataset.category;
      renderPosts();
    });
  });
}

const SUPABASE_URL = "https://xzrkzzkpxrzhalqtqzfg.supabase.co";
const SUPABASE_KEY = "sb_publishable_tm6lrmqnXLD7yY-NjZkfOg_aItu81Nv";
const CLIENT_ID = getClientId();
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { "x-client-id": CLIENT_ID } }
});

let messages = [];

function getClientId() {
  let id = localStorage.getItem("message-client-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("message-client-id", id);
  }
  return id;
}

function formatTime(date) {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function renderMessages() {
  const list = document.getElementById("message-list");
  list.innerHTML = messages.map(msg => `
    <li class="message-item">
      ${msg.client_id === CLIENT_ID ? `<button class="message-delete" data-id="${msg.id}" title="删除">&times;</button>` : ""}
      <p class="message-text">${escapeHtml(msg.text)}</p>
      <span class="message-time">${formatTime(new Date(msg.created_at))}</span>
    </li>
  `).join("");
}

function addMessage(msg) {
  if (messages.some(m => m.id === msg.id)) return;
  messages.push(msg);
  renderMessages();
}

async function loadMessages() {
  const { data, error } = await supabaseClient
    .from("messages")
    .select("id, text, created_at, client_id")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("加载留言失败:", error);
    return;
  }
  messages = data;
  renderMessages();
}

function subscribeMessages() {
  supabaseClient
    .channel("messages-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => addMessage(payload.new)
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "messages" },
      (payload) => {
        messages = messages.filter(m => m.id !== payload.old.id);
        renderMessages();
      }
    )
    .subscribe();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function setupMessageInput() {
  const input = document.getElementById("message-input");
  const btn = document.getElementById("send-btn");
  const list = document.getElementById("message-list");

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    btn.disabled = true;
    const { data, error } = await supabaseClient
      .from("messages")
      .insert({ text, client_id: CLIENT_ID })
      .select("id, text, created_at, client_id")
      .single();
    btn.disabled = false;
    if (error) {
      console.error("发送失败:", error);
      alert("发送失败，请稍后再试");
      return;
    }
    input.value = "";
    addMessage(data);
  }

  btn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });

  list.addEventListener("click", async (e) => {
    const delBtn = e.target.closest(".message-delete");
    if (!delBtn) return;
    if (!confirm("删除这条留言？")) return;

    const id = Number(delBtn.dataset.id);
    delBtn.disabled = true;
    const { data, error } = await supabaseClient
      .from("messages")
      .delete()
      .eq("id", id)
      .select("id");

    if (error || !data || data.length === 0) {
      delBtn.disabled = false;
      console.error("删除失败:", error);
      alert("删除失败：" + (error ? error.message : "没有删除权限"));
      return;
    }

    messages = messages.filter(m => m.id !== id);
    renderMessages();
  });
}

async function loadPosts() {
  const { data, error } = await supabaseClient
    .from("posts")
    .select("id, title, content, excerpt, event_date, category, images, client_id, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("加载记录失败:", error);
    return;
  }
  dbPosts = data;
  renderPosts();
}

function subscribePosts() {
  supabaseClient
    .channel("posts-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "posts" },
      (payload) => {
        if (dbPosts.some(p => p.id === payload.new.id)) return;
        dbPosts.unshift(payload.new);
        renderPosts();
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "posts" },
      (payload) => {
        const idx = dbPosts.findIndex(p => p.id === payload.new.id);
        if (idx !== -1) dbPosts[idx] = payload.new;
        renderPosts();
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "posts" },
      (payload) => {
        dbPosts = dbPosts.filter(p => p.id !== payload.old.id);
        renderPosts();
      }
    )
    .subscribe();
}

async function uploadImages(files) {
  const urls = [];
  for (const file of files) {
    const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "jpg";
    const path = `${CLIENT_ID}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseClient.storage.from("post-images").upload(path, file);
    if (error) throw error;
    const { data } = supabaseClient.storage.from("post-images").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

function setupCompose() {
  const modal = document.getElementById("compose-modal");
  const openBtn = document.getElementById("compose-open");
  const closeBtn = document.getElementById("compose-close");
  const heading = document.getElementById("compose-heading");
  const imagesArea = document.getElementById("compose-images-area");
  const titleInput = document.getElementById("compose-title");
  const excerptInput = document.getElementById("compose-excerpt");
  const dateInput = document.getElementById("compose-date");
  const textInput = document.getElementById("compose-text");
  const categorySelect = document.getElementById("compose-category");
  const fileInput = document.getElementById("compose-images");
  const previews = document.getElementById("compose-previews");
  const submitBtn = document.getElementById("compose-submit");
  let selectedFiles = [];
  let editingId = null;

  function reset() {
    editingId = null;
    titleInput.value = "";
    excerptInput.value = "";
    dateInput.value = "";
    textInput.value = "";
    categorySelect.value = "uk";
    fileInput.value = "";
    selectedFiles = [];
    previews.innerHTML = "";
    heading.textContent = "记录这一刻";
    imagesArea.hidden = false;
    submitBtn.textContent = "发布";
  }

  function close() {
    modal.classList.remove("show");
    document.body.style.overflow = "";
    reset();
  }

  function open(post) {
    editingId = post ? post.id : null;
    heading.textContent = post ? "编辑记录" : "记录这一刻";
    imagesArea.hidden = !!post;
    submitBtn.textContent = post ? "保存修改" : "发布";
    if (post) {
      titleInput.value = post.title || "";
      excerptInput.value = post.excerpt || "";
      dateInput.value = post.event_date || "";
      textInput.value = post.content || "";
      categorySelect.value = post.category || "uk";
    }
    modal.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  openEditPost = open;

  openBtn.addEventListener("click", () => open(null));

  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  fileInput.addEventListener("change", () => {
    selectedFiles = Array.from(fileInput.files);
    previews.innerHTML = selectedFiles
      .map(file => `<img src="${URL.createObjectURL(file)}" alt="">`)
      .join("");
  });

  submitBtn.addEventListener("click", async () => {
    const title = titleInput.value.trim();
    const excerpt = excerptInput.value.trim();
    const eventDate = dateInput.value;
    const content = textInput.value.trim();
    const category = categorySelect.value;

    if (!title) {
      alert("请填写标题");
      return;
    }
    if (!content) {
      alert("请填写文字");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = editingId ? "保存中..." : "发布中...";
    try {
      if (editingId) {
        const { data, error } = await supabaseClient
          .from("posts")
          .update({
            title,
            content,
            excerpt: excerpt || null,
            event_date: eventDate || null,
            category
          })
          .eq("id", editingId)
          .select("id, title, content, excerpt, event_date, category, images, client_id, created_at")
          .single();
        if (error) throw error;
        const idx = dbPosts.findIndex(p => p.id === data.id);
        if (idx !== -1) dbPosts[idx] = data;
      } else {
        const images = await uploadImages(selectedFiles);
        const { data, error } = await supabaseClient
          .from("posts")
          .insert({
            title,
            content,
            excerpt: excerpt || null,
            event_date: eventDate || null,
            category,
            images,
            client_id: CLIENT_ID
          })
          .select("id, title, content, excerpt, event_date, category, images, client_id, created_at")
          .single();
        if (error) throw error;
        if (!dbPosts.some(p => p.id === data.id)) dbPosts.unshift(data);
      }
      renderPosts();
      close();
    } catch (err) {
      console.error("保存失败:", err);
      alert("保存失败：" + (err.message || "请稍后再试"));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = editingId ? "保存修改" : "发布";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderPosts();
  setupMainNav();
  setupNav();
  setupModal();
  setupMessageInput();
  setupCompose();
  loadMessages();
  subscribeMessages();
  loadPosts();
  subscribePosts();
});
