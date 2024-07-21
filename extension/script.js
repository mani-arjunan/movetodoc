function getGoogleAuthURL() {
  const SERVER_URL = "https://gd.mh-home.xyz";
  const CLIENT_ID = "733584878721-pfvg1kv047ujg7r3ko2b8j565klducj9";
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";

  const options = {
    redirect_uri: SERVER_URL,
    client_id: CLIENT_ID,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/documents",
    ].join(" "),
  };

  const qs = new URLSearchParams(options);

  return `${rootUrl}?${qs.toString()}`;
}

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

      try {
        res(await response.json());
      } catch (e) {
        switchLoader(false);
        alert("Unable to convert response to JSON. Please try again");
      }
    } catch (e) {
      chrome.runtime.sendMessage({ action: "clear-cookies-if-present" });
      switchLoader(false);
    }
  });
};

function createFormInput(parent, cb) {
  const inputWrapperDiv = document.createElement("div");
  const submitWrapperDiv = document.createElement("div");
  const input = document.createElement("input");
  const submit = document.createElement("button");
  const logout = document.createElement("button");
  logout.setAttribute("id", "logoutButton");
  logout.innerText = "logout";
  inputWrapperDiv.setAttribute("id", "inputWrapperDiv");
  submitWrapperDiv.setAttribute("id", "submitWrapperDiv");
  input.setAttribute("placeholder", "Enter Document name to create");
  submit.setAttribute("id", "submitButton");
  submit.innerText = "submit";

  inputWrapperDiv.appendChild(input);
  inputWrapperDiv.appendChild(logout);
  submitWrapperDiv.appendChild(submit);

  parent.appendChild(inputWrapperDiv);
  parent.appendChild(submitWrapperDiv);

  submit.addEventListener("click", () => cb(input));
  logout.addEventListener("click", () => {
    switchLoader(true);
    chrome.runtime.sendMessage({ action: "logout" });
  });
}

function createLi(title, href) {
  const li = document.createElement("li");
  li.setAttribute("class", "formLi");
  const a = document.createElement("a");
  a.setAttribute("href", href);
  a.setAttribute("target", "_blank");
  a.innerHTML = title;
  const input = document.createElement("input");
  input.setAttribute("type", "radio");
  input.setAttribute("value", title);
  input.setAttribute("name", title.toLowerCase());
  li.appendChild(a);

  return li;
}

function createFormList(data, ul, parent) {
  for (let i = 0; i < data.length; i++) {
    const li = createLi(data[i].title, data[i].href);

    ul.appendChild(li);
  }

  parent.appendChild(ul);
}

async function getCookie() {
  return new Promise((res) => {
    chrome.runtime.sendMessage({ action: "get-cookies" }, (cookie) => {
      res(cookie);
    });
  });
}

async function createDoc(docName) {
  return new Promise((res) => {
    chrome.runtime.sendMessage(
      { action: "create-doc", data: docName },
      (data) => {
        res(data);
      },
    );
  });
}

function switchLoader(bool) {
  const loaderDiv = document.getElementById("loader");
  loaderDiv.style.display = bool ? "block" : "none";
}

function transformData(data) {
  return data.map((d) => {
    return {
      title: d.title,
      href: d.docUrl,
    };
  });
}

function showGoogleLogin() {
  const googleAuthURL = getGoogleAuthURL();
  const button = document.createElement("button");
  button.setAttribute("id", "googleButton");

  const a = document.createElement("a");
  a.setAttribute("href", googleAuthURL);
  a.setAttribute("target", "_blank");
  a.innerText = "Google Login";
  a.style.textDecoration = "none";

  button.appendChild(a);

  body.appendChild(button);
}

async function main() {
  const SERVER_URL = "https://gd.mh-home.xyz";
  switchLoader(true);
  const cookie = await getCookie();
  switchLoader(false);
  const body = document.getElementById("body");

  if (cookie) {
    switchLoader(true);
    const { refreshToken, userId } = JSON.parse(decodeURIComponent(cookie));

    // Rare case, but handled
    if (!refreshToken || !userId) {
      alert("Error");
      switchLoader(false);
      showGoogleLogin();
      return;
    }

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
    switchLoader(false);
    if (data.error) {
      const action = {
        EXPIRED: function () {
          alert("Session Expired! Login Again");
          chrome.runtime.sendMessage({ action: "clear-cookies-if-present" });
        },
        AUTH_CODE_NOT_FOUND: function () {
          alert("Error! Login Again");
          chrome.runtime.sendMessage({ action: "clear-cookies-if-present" });
        },
        USER_NOT_FOUND: function () {
          alert("User not found! Login Again");
          chrome.runtime.sendMessage({ action: "clear-cookies-if-present" });
        },
      };

      action[data.code] && action[data.code]();

      showGoogleLogin();
      return;
    }

    const formWrapperDiv = document.createElement("div");
    formWrapperDiv.setAttribute("class", "formWrapper");
    body.appendChild(formWrapperDiv);

    const ol = document.createElement("ol");

    const callback = async function (input) {
      switchLoader(true);
      const response = await createDoc(input.value);

      if (response.error) {
        const action = {
          OTHER_ERROR: function () {
            alert("Internal Server Error! Login again");
          },
          SCOPE_NOT_DEFINED: function () {
            alert("Try to logout and login again with permitting valid scopes");
          },
        };
        action[response.code] && action[response.code]();

        switchLoader(false);
        return;
      }

      const { data } = response;

      if (data.length === 1) {
        createFormList(transformData(data), ol, formWrapperDiv);
      } else {
        const transformedData = transformData(data);
        const li = createLi(
          transformedData[transformedData.length - 1].title,
          transformedData[transformedData.length - 1].href,
        );
        ol.appendChild(li);
      }
      switchLoader(false);
    };

    createFormInput(formWrapperDiv, callback);

    if (data.length != 0) {
      createFormList(transformData(data), ol, formWrapperDiv);
      chrome.runtime.sendMessage({ action: "update-context-menus", data });
    }
  } else {
    showGoogleLogin();
  }
}

main();
