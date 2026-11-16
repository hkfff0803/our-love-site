// 留言板写作区的附加交互：字数统计与空态按钮
// 只做展示层逻辑，发送仍由 script.js 负责
(function () {
  const input = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const countEl = document.getElementById("message-count");
  if (!input || !sendBtn || !countEl) return;

  const max = Number(input.getAttribute("maxlength")) || 1500;

  function update() {
    const len = input.value.length;
    countEl.textContent = len + "/" + max;
    countEl.classList.toggle("is-near", len >= max * 0.9);
    sendBtn.classList.toggle("is-empty", len === 0);
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
      proto.set.call(this, v);
      update();
    },
  });

  input.addEventListener("input", update);
  update();
})();
