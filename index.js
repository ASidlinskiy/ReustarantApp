const startupStatus = document.querySelector("#app-status");
import("./app.js")
  .then(() => {
    startupStatus.hidden = true;
  })
  .catch(() => {
    startupStatus.replaceChildren();
    startupStatus.append("We could not load the menu. Check your connection and ");
    const reload = document.createElement("a");
    reload.href = "./";
    reload.textContent = "reload the page";
    startupStatus.append(reload, ". No order has been sent.");
    document.querySelectorAll("button, input, textarea").forEach((control) => {
      control.disabled = true;
    });
  });
