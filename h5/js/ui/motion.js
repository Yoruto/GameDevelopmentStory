(function (root) {
  // Motion contract: the caller reserves layout space; animated children only
  // change transform/opacity. All transient effects use play/cancel so a scene
  // switch, a replay, or reduced motion cannot leave stale animation state.
  var ui = root.GDS.ui;
  var doc = root.document;
  var active = new WeakMap();
  var values = new WeakMap();

  function reduced() {
    return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function settle(run, completed) {
    if (active.get(run.owner) !== run) return;
    root.clearTimeout(run.timer);
    run.element.removeEventListener("animationend", run.onEnd);
    if (run.className) run.element.classList.remove(run.className);
    active.delete(run.owner);
    if (completed && run.onComplete) run.onComplete();
    if (!completed && run.onCancel) run.onCancel();
  }

  // One owner has at most one decorative animation. Completion is event driven,
  // with a timeout for WebViews that do not dispatch animationend reliably.
  ui.motion = {
    reduced: reduced,
    text: function (el) {
      return el && values.has(el) ? values.get(el) : (el ? el.textContent : "");
    },
    setText: function (el, value) {
      if (!el) return;
      value = String(value);
      // A repaint with the same logical value must not interrupt a tick's
      // completion callback while the decorative date roll is still running.
      if (active.has(el) && values.get(el) === value) return;
      this.cancel(el);
      values.set(el, value);
      el.textContent = value;
    },
    cancel: function (owner) {
      var run = owner && active.get(owner);
      if (run) settle(run, false);
    },
    play: function (owner, element, className, duration, onComplete, onCancel) {
      if (!owner || !element) return;
      this.cancel(owner);
      if (reduced()) {
        if (onComplete) onComplete();
        return;
      }
      var run = { owner: owner, element: element, className: className,
        onComplete: onComplete, onCancel: onCancel, timer: null, onEnd: null };
      run.onEnd = function (event) {
        if (event.target === element) settle(run, true);
      };
      active.set(owner, run);
      element.addEventListener("animationend", run.onEnd);
      if (className) element.classList.add(className);
      run.timer = root.setTimeout(function () { settle(run, true); }, duration + 50);
    },
    rollText: function (el, fromText, onComplete) {
      if (!el) {
        if (onComplete) onComplete();
        return;
      }
      this.cancel(el);
      var toText = this.text(el);
      if (!fromText || fromText === toText || reduced()) {
        if (onComplete) onComplete();
        return;
      }
      var wrap = doc.createElement("span");
      var oldText = doc.createElement("span");
      var newText = doc.createElement("span");
      wrap.className = "date-roll";
      oldText.className = "date-roll-out";
      newText.className = "date-roll-in";
      oldText.textContent = fromText;
      newText.textContent = toText;
      wrap.appendChild(newText);
      wrap.appendChild(oldText);
      el.textContent = "";
      el.appendChild(wrap);
      var restore = function () {
        if (wrap.parentNode === el) el.textContent = toText;
      };
      this.play(el, oldText, null, 1000, function () {
        restore();
        if (onComplete) onComplete();
      }, restore);
    },
    floatText: function (parent, value) {
      if (!parent || reduced()) return;
      var floater = doc.createElement("span");
      floater.className = "stat-float";
      floater.textContent = value;
      parent.appendChild(floater);
      this.play(floater, floater, null, 500, function () {
        if (floater.parentNode) floater.parentNode.removeChild(floater);
      });
    }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
