# google-doc-extension

A simple extension to save notes from any website into your google doc

## Technology Stack

    - Node.js
    - Docker
    - Redis

## Dependencies

    - Node.js
    - Docker
    - Redis

### step 1: Follow BE Readme

`location of BE repo: ./be/README.md`
Once the BE has been started, you can use the extension.

### step 2: Unpack the extension

    - Go to your preferred chromium browser(eg: Google Chrome).
    - go to chrome://extensions.
    - Enable the developer mode.
    - Click on "Load unpacked extension".
    - Select the `extension` folder you have downloaded from this repo.

This is it, you can now use the extension.

## What can you do with this extension?

    - You can login to your Google Account using your gmail id.
    - Ensure to give access to scopes such as userInfo, documents.
    - Once loggedIn you can create any new Google Doc.
    - Once you created any new Google Doc, You must see a chrome context menu named (`MoveToDoc`).
    - `MoveToDoc` contextmenu will have all your newly created Google doc from this extension.
    - Now you can select any text from any webpage and click on to any specific created doc `MoveToDoc` context menu, with this your selected
text will automatically be copied to google doc with timestamp and metadata.


## ScreenShot

### Login Page of the extension

![login](extension/screenshots/login_page_extension.png)

### Home Page of the extension

![home](./extension/screenshots/home_page_extension.png)

### Home Page With Created Doc extension

![home_with_doc](./extension/screenshots/home_page_with_created_doc_extension.png)

### MoveToDoc ContextMenu

![extension](./extension/screenshots/movetodoc_context_menu.png)


## In Pipeline features:

    - `search in google docs across all the docs that you have created`
    - `Include copied metadata in the doc`
    - `Improve extension UI`

