![Banner](/static/milktea_banner.png)

<div align="center">

![JavaScript](https://img.shields.io/badge/-JavaScript-05122A?style=flat&logo=javascript)&nbsp;
![SvelteKit](https://img.shields.io/badge/-SvelteKit-05122A?style=flat&logo=svelte)&nbsp;
![Tauri](https://img.shields.io/badge/-Tauri-05122A?style=flat&logo=tauri)&nbsp;
![Tailwind](https://img.shields.io/badge/-Tailwind-05122A?style=flat&logo=tailwindcss)&nbsp;

</div>

## Introduction

Milk Tea (stylized as MilkTea) is a project that aims to create an alternative client for the web-based survival game [zombia.io](https://zombia.io). A work in progress 🚧

## Install
Get the binaries from the [Releases](https://github.com/AyuBloom/MilkTea/releases/latest) page!

### For macOS Users
When you encounter this error: `"MilkTea.app" is damaged and can't be opened.`, it is because to notarize the app, I need a $99/year certificate from Apple and I am NOT paying that.

To fix it, run this command after you have placed the app in the Applications folder:
```sh
xattr -d com.apple.quarantine /Applications/MilkTea.app
```

## Development

### Setup

#### 1. Setup Tauri
Follow the prerequisites page for building Tauri ([here](https://v2.tauri.app/start/prerequisites/)).
(If any problems arise, please make an issue) <br>
Install NPM dependencies if you haven't already:
```sh
pnpm i
```

#### 2. Debug or build the client
##### Debug
To debug, run:
```sh
pnpm run tauri dev
```

##### Build
To build the client, run:
```sh
pnpm run tauri build
```

### Tools
The project provides you with a decent selection of CLI tools that you can use to make development easier. See more at [`tools`](/tools).

## Extras
This project also contains a folder that is an archive of every (unminified) version of the web client's `app.js` file since public release. You can check them out at [`archive`](/archive).

