const CATEGORY_MAP = {
  uk: "英国",
  wuhan: "武汉",

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
  const rows = dbPosts.slice().sort((a, b) => {
    if (a.event_date && b.event_date) {
      if (a.event_date !== b.event_date) return a.event_date < b.event_date ? -1 : 1;
      return (a.created_at || "").localeCompare(b.created_at || "");
    }
    if (a.event_date) return -1;
    if (b.event_date) return 1;
    return (a.created_at || "").localeCompare(b.created_at || "");
  });
  return rows.map(toPost);
}

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

  if (!allPosts.length) {
    gallery.innerHTML = `<div class="empty-state">还没有记录，点「+ 记录」写下第一段吧</div>`;
    return;
  }

  gallery.innerHTML = allPosts.map(post => {
    const firstImg = post.images[0];
    const multi = post.images.length > 1;
    const imageHtml = firstImg
      ? `<img class="card-image" src="${firstImg}" alt="${escapeHtml(post.title)}" loading="lazy">`
      : `<div class="card-image-empty">&#9825;</div>`;
    return `
    <article class="card" data-key="${post.key}">
      <span class="card-tape" aria-hidden="true"></span>
      <span class="card-corners" aria-hidden="true"></span>
      <span class="card-clip" aria-hidden="true">
        <svg viewBox="0 0 22 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M4 12v20a7 7 0 0 0 14 0V8a5 5 0 0 0-10 0v22a3 3 0 0 0 6 0V13" />
        </svg>
      </span>
      <div class="card-image-wrap">
        ${imageHtml}
        ${multi ? `<span class="card-img-count">${post.images.length}图</span>` : ""}
      </div>
      <div class="card-body">
        <span class="card-tag">${CATEGORY_MAP[post.category] || ""}</span>
        <h3 class="card-title">${escapeHtml(post.title)}</h3>
        <p class="card-excerpt">${escapeHtml(post.excerpt)}</p>
        <span class="card-date">${post.date}</span>
      </div>
    </article>
  `;
  }).join("");

  if (!gallery.dataset.entered) {
    gallery.dataset.entered = "1";
    gallery.classList.add("is-entering");
    setTimeout(() => gallery.classList.remove("is-entering"), 1600);
  }

  gallery.querySelectorAll(".card-image").forEach(img => {
    if (img.complete) {
      img.classList.add("loaded");
    } else {
      img.addEventListener("load", () => img.classList.add("loaded"));
    }
  });

  gallery.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => openModal(card.dataset.key));
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
    `<div class="modal-slide"><img src="${src}" alt="${post.title}" title="点击查看原图"></div>`
  ).join("");

  track.querySelectorAll("img").forEach(img => {
    img.addEventListener("click", () => {
      window.open(img.src, "_blank", "noopener");
    });
  });

  dots.innerHTML = post.images.length > 1
    ? post.images.map((_, i) => `<button class="modal-dot${i === 0 ? " active" : ""}" data-idx="${i}"></button>`).join("")
    : "";

  document.getElementById("modal-tag").textContent = CATEGORY_MAP[post.category] || "";
  document.getElementById("modal-date").textContent = post.date || "";
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
    carousel.dragging = false;
    carousel.locked = null;
    carousel.startX = e.touches[0].clientX;
    carousel.startY = e.touches[0].clientY;
    carousel.currentX = carousel.startX;
    track.classList.remove("smooth");
  }, { passive: true });

  track.addEventListener("touchmove", (e) => {
    const dx = e.touches[0].clientX - carousel.startX;
    const dy = e.touches[0].clientY - carousel.startY;

    if (!carousel.locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) < Math.abs(dy)) {
        carousel.locked = "y";
        return;
      }
      carousel.locked = "x";
      carousel.dragging = true;
    }

    if (carousel.locked !== "x") return;

    carousel.currentX = e.touches[0].clientX;
    const diff = carousel.currentX - carousel.startX;
    const w = carousel.containerWidth || track.parentElement.clientWidth;
    track.style.transform = `translateX(calc(-${carousel.index * w}px + ${diff}px))`;
  }, { passive: true });

  track.addEventListener("touchend", () => {
    if (!carousel.dragging) {
      carousel.locked = null;
      return;
    }
    carousel.dragging = false;
    carousel.locked = null;
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

  document.getElementById("modal-edit").addEventListener("click", () => {
    const post = carousel.post;
    if (!post) return;
    const row = dbPosts.find(p => p.id === post.id);
    closeModal();
    if (row && openEditPost) openEditPost(row);
  });

  document.getElementById("modal-delete").addEventListener("click", () => {
    const post = carousel.post;
    if (!post) return;
    closeModal();
    deletePost(post.id);
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

const SUPABASE_URL = "https://xzrkzzkpxrzhalqtqzfg.supabase.co";
const SUPABASE_KEY = "sb_publishable_tm6lrmqnXLD7yY-NjZkfOg_aItu81Nv";
const CLIENT_ID = getClientId();
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { "x-client-id": CLIENT_ID } }
});

let messages = [];
const expandedMessageIds = new Set();

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
  list.innerHTML = messages.map(msg => {
    const long = msg.text.length > 180;
    const expanded = expandedMessageIds.has(msg.id);
    const clamped = long && !expanded;
    return `
    <li class="message-item">
      ${msg.client_id === CLIENT_ID ? `<button class="message-delete" data-id="${msg.id}" title="删除">&times;</button>` : ""}
      <p class="message-text${clamped ? " is-clamped" : ""}">${escapeHtml(msg.text)}</p>
      ${long ? `<button class="message-toggle" type="button" data-id="${msg.id}">${expanded ? "收起" : "展开"}</button>` : ""}
      <span class="message-time">${formatTime(new Date(msg.created_at))}</span>
    </li>
  `;
  }).join("");
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

  function autoGrow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 150) + "px";
  }

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
    autoGrow();
    addMessage(data);
  }

  input.addEventListener("input", autoGrow);
  btn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      send();
    }
  });

  list.addEventListener("click", async (e) => {
    const toggleBtn = e.target.closest(".message-toggle");
    if (toggleBtn) {
      const id = Number(toggleBtn.dataset.id);
      if (expandedMessageIds.has(id)) {
        expandedMessageIds.delete(id);
      } else {
        expandedMessageIds.add(id);
      }
      renderMessages();
      return;
    }

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
    expandedMessageIds.delete(id);
    renderMessages();
  });
}

async function loadPosts() {
  const { data, error } = await supabaseClient
    .from("posts")
    .select("id, title, content, excerpt, event_date, category, images, client_id, created_at")
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
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

async function compressImage(file, maxSide = 1600, quality = 0.8) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size <= 800 * 1024) {
      bitmap.close?.();
      return file;
    }
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;
    const name = file.name.replace(/\.(heic|heif|png|webp|jpg|jpeg)$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch (err) {
    console.warn("图片压缩失败，改用原图:", err);
    return file;
  }
}

async function uploadImageFile(file) {
  const upload = await compressImage(file);
  const ext = upload.name.includes(".") ? upload.name.split(".").pop().toLowerCase() : "jpg";
  const path = `${CLIENT_ID}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseClient.storage.from("post-images").upload(path, upload);
  if (error) throw error;
  const { data } = supabaseClient.storage.from("post-images").getPublicUrl(path);
  return data.publicUrl;
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
  const progressEl = document.getElementById("compose-progress");
  const submitBtn = document.getElementById("compose-submit");
  let imageItems = [];
  let editingId = null;
  let drag = null;

  function releasePreviewUrls() {
    imageItems.forEach(item => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  }

  function renderPreviews() {
    previews.innerHTML = imageItems.map((item, i) => {
      const src = item.kind === "url" ? item.url : item.previewUrl;
      const safeSrc = escapeHtml(src).replace(/"/g, "&quot;");
      return `
      <div class="preview-item" data-index="${i}">
        <img src="${safeSrc}" alt="" draggable="false">
        ${item.kind === "file" ? `<span class="preview-new">新</span>` : ""}
        <button class="preview-remove" type="button" data-index="${i}" title="移除这张">&times;</button>
      </div>`;
    }).join("");
  }

  function reset() {
    editingId = null;
    titleInput.value = "";
    excerptInput.value = "";
    dateInput.value = "";
    textInput.value = "";
    categorySelect.value = "uk";
    fileInput.value = "";
    releasePreviewUrls();
    imageItems = [];
    renderPreviews();
    progressEl.hidden = true;
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
    submitBtn.textContent = post ? "保存修改" : "发布";
    releasePreviewUrls();
    imageItems = post ? (post.images || []).map(url => ({ kind: "url", url })) : [];
    renderPreviews();
    progressEl.hidden = true;
    imagesArea.hidden = false;
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

  function finishDrag(pointerX, pointerY) {
    const dragging = drag;
    const el = dragging.el;
    const nodes = Array.from(previews.children);
    const beforeRects = new Map(nodes.map(node => [node, node.getBoundingClientRect()]));

    const siblings = nodes.filter(node => node !== el);
    let insertAt = 0;
    let nearest = -1;
    let min = Infinity;

    siblings.forEach((node, i) => {
      const rect = node.getBoundingClientRect();
      const distance = Math.hypot(
        pointerX - (rect.left + rect.width / 2),
        pointerY - (rect.top + rect.height / 2)
      );
      if (distance < min) {
        min = distance;
        nearest = i;
      }
    });

    if (nearest !== -1) {
      const rect = siblings[nearest].getBoundingClientRect();
      insertAt = pointerX > rect.left + rect.width / 2 ? nearest + 1 : nearest;
    }

    const fromIndex = imageItems.indexOf(dragging.item);
    if (fromIndex !== -1) {
      imageItems.splice(fromIndex, 1);
      imageItems.splice(insertAt, 0, dragging.item);
    }

    el.classList.remove("is-dragging");
    el.style.transform = "";
    el.style.transition = "none";
    previews.insertBefore(el, siblings[insertAt] || null);

    Array.from(previews.children).forEach((node, i) => {
      node.dataset.index = String(i);
      const btn = node.querySelector(".preview-remove");
      if (btn) btn.dataset.index = String(i);
    });

    Array.from(previews.children).forEach(node => {
      if (node === el) return;
      const before = beforeRects.get(node);
      if (!before) return;
      const after = node.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      node.style.transition = "none";
      node.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        node.style.transition = "transform 200ms cubic-bezier(0.22, 0.68, 0.24, 1)";
        node.style.transform = "";
      });
    });

    drag = null;
  }

  openEditPost = open;

  openBtn.addEventListener("click", () => open(null));

  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  previews.addEventListener("click", (e) => {
    const btn = e.target.closest(".preview-remove");
    if (!btn) return;
    const idx = Number(btn.dataset.index);
    const item = imageItems[idx];
    if (!item) return;
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    imageItems.splice(idx, 1);
    renderPreviews();
  });

  previews.addEventListener("pointerdown", (e) => {
    const itemEl = e.target.closest(".preview-item");
    if (!itemEl || e.target.closest(".preview-remove")) return;
    if (e.button !== undefined && e.button !== 0) return;
    drag = {
      el: itemEl,
      item: imageItems[Number(itemEl.dataset.index)],
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      active: false
    };
    itemEl.setPointerCapture(e.pointerId);
  });

  previews.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (!drag.active) {
      if (Math.hypot(dx, dy) < 6) return;
      drag.active = true;
      drag.el.classList.add("is-dragging");
    }

    drag.el.style.transform = `translate(${dx}px, ${dy}px)`;
  });

  previews.addEventListener("pointerup", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.active) {
      drag = null;
      return;
    }
    finishDrag(e.clientX, e.clientY);
  });

  previews.addEventListener("pointercancel", () => {
    if (!drag) return;
    drag.el.style.transform = "";
    drag.el.classList.remove("is-dragging");
    drag = null;
  });

  fileInput.addEventListener("change", () => {
    const files = Array.from(fileInput.files || []);
    files.forEach(file => {
      imageItems.push({ kind: "file", file, previewUrl: URL.createObjectURL(file) });
    });
    fileInput.value = "";
    renderPreviews();
  });

  async function collectImageUrls() {
    const newCount = imageItems.filter(item => item.kind === "file").length;
    let uploaded = 0;
    const urls = [];
    for (const item of imageItems) {
      if (item.kind === "url") {
        urls.push(item.url);
        continue;
      }
      uploaded += 1;
      progressEl.hidden = false;
      progressEl.textContent = `上传中 第 ${uploaded}/${newCount} 张…`;
      urls.push(await uploadImageFile(item.file));
    }
    progressEl.hidden = true;
    return urls;
  }

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
      const images = await collectImageUrls();
      if (editingId) {
        const { data, error } = await supabaseClient
          .from("posts")
          .update({
            title,
            content,
            excerpt: excerpt || null,
            event_date: eventDate || null,
            category,
            images
          })
          .eq("id", editingId)
          .select("id, title, content, excerpt, event_date, category, images, client_id, created_at")
          .single();
        if (error) throw error;
        const idx = dbPosts.findIndex(p => p.id === data.id);
        if (idx !== -1) dbPosts[idx] = data;
      } else {
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
      progressEl.hidden = true;
      console.error("保存失败:", err);
      alert("保存失败：" + (err.message || "请稍后再试"));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = editingId ? "保存修改" : "发布";
    }
  });
}

function setupAmbient() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const glow = document.getElementById("cursor-glow");
  if (glow && window.matchMedia("(hover: hover)").matches) {
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let x = tx;
    let y = ty;

    window.addEventListener("mousemove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
      glow.style.opacity = "1";
    }, { passive: true });

    (function loop() {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      glow.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(loop);
    })();
  }

  const flower = document.querySelector(".deco-flower");
  const postmark = document.querySelector(".deco-postmark");
  if (flower && postmark && window.matchMedia("(min-width: 641px)").matches) {
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        flower.style.transform = `translateY(${y * 0.04}px)`;
        postmark.style.transform = `translateY(${y * -0.04}px)`;
        ticking = false;
      });
    }, { passive: true });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderPosts();
  setupMainNav();
  setupModal();
  setupMessageInput();
  setupCompose();
  setupAmbient();
  loadMessages();
  subscribeMessages();
  loadPosts();
  subscribePosts();
});
