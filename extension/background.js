const SERVER_URL = "https://gd.mh-home.xyz";

const makeRequest = async (url, method, payload, additionalHeaders) => {
  const headers =
    method === "POST"
      ? {
          "Content-Type": "application/json",
          ...additionalHeaders,
        }
      : { ...additionalHeaders };

  return new Promise(async (res, rej) => {
    try {
      const response = await fetch(url, {
        method,
        ...(payload && { body: JSON.stringify(payload) }),
        headers,
      });
      res(await response.json());
    } catch (e) {
      console.log(e);
    }
  });
};

async function getCookie() {
  const COOKIE_NAME = "google-auth-token";

  return new Promise((res) => {
    chrome.cookies.get(
      { url: SERVER_URL, name: COOKIE_NAME },
      function (cookie) {
        if (cookie) {
          res(cookie.value);
        } else {
          res("");
        }
      },
    );
  });
}

async function deleteCookie() {
  const COOKIE_NAME = "google-auth-token";

  return new Promise((res) => {
    chrome.cookies.remove(
      { url: SERVER_URL, name: COOKIE_NAME },
      function (cookie) {
        if (cookie) {
          res(cookie.value);
        } else {
          res("");
        }
      },
    );
  });
}

function createContextMenus(data) {
  chrome.contextMenus.create({
    title: "MoveToDoc",
    id: "move-to-doc",
    contexts: ["all"],
  });
  data.forEach((d, i) => {
    chrome.contextMenus.create({
      title: d.title,
      id: d.documentId,
      parentId: "move-to-doc",
      contexts: ["all"],
    });
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll();
  const cookie = await getCookie();
  if (cookie) {
    const { refreshToken, userId } = JSON.parse(decodeURIComponent(cookie));

    // Rare case, but handled
    if (!refreshToken || !userId) {
      alert("Error");
      showGoogleLogin();
      return;
    }

    try {
      const data = await makeRequest(
        `${SERVER_URL}/list-docs`,
        "POST",
        {
          userId,
        },
        {
          authorization: "Bearer " + refreshToken,
        },
      );
      if (!data.error) {
        createContextMenus(data);
      }
    } catch (e) {}
  }
});

chrome.commands.onCommand.addListener(async (shortcut) => {
  if (shortcut === "Ctrl+M") {
    await chrome.contextMenus.removeAll();
    const cookie = await getCookie();
    if (cookie) {
      const { refreshToken, userId } = JSON.parse(decodeURIComponent(cookie));

      // Rare case, but handled
      if (!refreshToken || !userId) {
        alert("Error");
        showGoogleLogin();
        return;
      }

      try {
        const data = await makeRequest(
          `${SERVER_URL}/list-docs`,
          "POST",
          {
            userId,
          },
          {
            authorization: "Bearer " + refreshToken,
          },
        );
        if (!data.error) {
          createContextMenus(data);
        }
      } catch (e) {}
    }
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const { menuItemId, frameUrl, selectionText } = info;
  const cookie = await getCookie();

  if (cookie) {
    const { refreshToken, userId } = JSON.parse(decodeURIComponent(cookie));

    // Rare case, but handled
    if (!refreshToken || !userId) {
      return;
    }
    try {
      const data = await makeRequest(
        `${SERVER_URL}/append-to-doc`,
        "POST",
        {
          userId,
          docId: menuItemId,
          sourceUrl: frameUrl,
          selectionText,
        },
        {
          authorization: "Bearer " + refreshToken,
        },
      );

      if (data.error) {
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    }
  }
});

async function logout() {
  const cookie = await getCookie();
  if (cookie) {
    const { refreshToken, userId } = JSON.parse(decodeURIComponent(cookie));

    // Rare case, but handled
    if (!refreshToken || !userId) {
      return;
    }
    try {
      await makeRequest(
        `${SERVER_URL}/logout`,
        "POST",
        {
          userId,
        },
        {
          authorization: "Bearer " + refreshToken,
        },
      );
    } catch (e) {}
  }
}

async function createDoc(docName) {
  const cookie = await getCookie();
  if (cookie) {
    const { refreshToken, userId } = JSON.parse(decodeURIComponent(cookie));

    // Rare case, but handled
    if (!refreshToken || !userId) {
      return;
    }

    try {
      const response = await makeRequest(
        `${SERVER_URL}/create-doc`,
        "POST",
        {
          docName: docName,
          userId,
        },
        {
          authorization: "Bearer " + refreshToken,
        },
      );
      return response;
    } catch (e) {}
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendMessage) => {
  const { action, data } = message;

  chrome.contextMenus.removeAll().then(async () => {
    if (action === "update-context-menus") {
      createContextMenus(data);
    } else if (action === "create-doc") {
      const response = await createDoc(data);
      sendMessage(response);
      createContextMenus(response.data);
    } else if (action === "get-cookies") {
      const cookie = await getCookie();
      sendMessage(cookie);
    } else if (action === "clear-cookies-if-present") {
      await deleteCookie();
      createContextMenus([]);
      chrome.runtime.reload();
    } else if (action === "logout") {
      await logout();
      await deleteCookie();
      createContextMenus([]);
      chrome.runtime.reload();
    }

    return true;
  });

  return true;
});
