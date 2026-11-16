// 留言板写作区的附加交互：字数统计、空态按钮、盖章动效
// 只做展示层逻辑，发送仍由 script.js 负责
(function () {
  const input = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const countEl = document.getElementById("message-count");
  const compose = document.getElementById("message-compose");
  if (!input || !sendBtn || !countEl || !compose) return;

  const max = Number(input.getAttribute("maxlength")) || 1500;
  let pendingSend = false;

  function update() {
    const len = input.value.length;
    countEl.textContent = len + "/" + max;
    countEl.classList.toggle("is-near", len >= max * 0.9);
    sendBtn.classList.toggle("is-empty", len === 0);
    return len;
  }

  // 拦截 value 赋值，覆盖 script.js 里程序化清空的情况
  const proto = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  );
  Object.defineProperty(input, "value", {
    configurable: true,
    get: function () {
      return proto.get.call(this);
    },
    set: function (v) {
      const before = proto.get.call(this);
      proto.set.call(this, v);
      const after = update();
      if (pendingSend && before !== "" && after === 0) {
        pendingSend = false;
        flashCompose();
      }
    },
  });

  function stamp() {
    sendBtn.classList.remove("is-stamp");
    void sendBtn.offsetWidth;
    sendBtn.classList.add("is-stamp");
    sendBtn.addEventListener(
      "animationend",
      function onEnd() {
        sendBtn.classList.remove("is-stamp");
        sendBtn.removeEventListener("animationend", onEnd);
      },
      { once: true }
    );
  }

  function flashCompose() {
    compose.classList.remove("is-flash");
    void compose.offsetWidth;
    compose.classList.add("is-flash");
    compose.addEventListener(
      "animationend",
      function onEnd() {
        compose.classList.remove("is-flash");
        compose.removeEventListener("animationend", onEnd);
      },
      { once: true }
    );
  }

  input.addEventListener("input", update);

  sendBtn.addEventListener("click", function () {
    stamp();
    pendingSend = true;
    setTimeout(function () {
      pendingSend = false;
    }, 6000);
  });

  update();
})();
