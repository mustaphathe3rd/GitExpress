# GitExpress 🌿

GitExpress brings the power and safety of Git version control directly into the Adobe Express creative workflow. This add-on provides designers with a robust system for saving meaningful versions (commits), experimenting with new ideas in isolated timelines (branches), and seamlessly combining work from different creative paths (merging), all from a simple panel inside Adobe Express.

---

## ✨ Features

* **Commit History:** Save snapshots of your work with descriptive messages. No more `design_final_v2_final.aepx`!
* **Branching:** Create new branches to experiment with different ideas without affecting your main design.
* **Merging:** Combine work from different branches with a true, three-way merge system.
* **Visual History:** Toggle between a simple list view and a dynamic Git graph to understand your project's entire history.
* **Compare Versions:** Select any two commits to see a visual, side-by-side comparison of the changes.
* **Revert Commits:** Safely undo any commit with a single click.
* **Efficient Storage:** Uses a delta-based commit engine with `lz4-wasm` compression to keep storage usage minimal.

---

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

Before you begin, ensure you have the following installed:

* **Node.js:** Version 18.0 or higher. You can [download it here](https://nodejs.org/).
* **npm:** Node Package Manager (comes with Node.js).
* **An Adobe Account:** A free Adobe account is required to use Adobe Express.

### Installation & Setup

Follow these simple steps to set up your local development environment.

1.  **Clone the repository:**

    Open your terminal or command prompt and run the following command to clone the project from GitHub:
    ```bash
    git clone https://github.com/mustaphathe3rd/GitExpress.git
    ```

2.  **Navigate to the project directory:**
    ```bash
    cd GitExpress
    ```

3.  **Install dependencies:**

    This command will download and install all the necessary libraries for the project.
    ```bash
    npm install
    ```

---

## 🏃‍♀️ Running the Add-on

Once the setup is complete, you can run the add-on locally.

### 1. Start the Development Server

In your terminal, run the following command. This will build the project and start a local server that Adobe Express can connect to.

```bash
npm run build
```

then

```bash
npm run start
```

Wait for the terminal to show a message like `Done. Your add-on 'gitexpress' is hosted on: https://localhost:5241/`. Keep this terminal window open.

### 2. Enable Developer Mode in Adobe Express
You only need to do this once.

1.  Log in to [Adobe Express](https://express.adobe.com/).
2.  Click on your profile avatar in the top-right corner, then click **Settings**.
3.  In the **General** tab, find the **Add-on Development** setting and toggle it on.

### 3. Load the Add-on in a Project
1.  Open any new or existing project in Adobe Express.
2.  Click the **Add-ons** icon in the left-hand rail.
3.  Click the **Your add-ons** tab.
4.  At the bottom, toggle **Add-on testing** to on.
5.  A prompt will ask for the local connection address. The default is usually correct (`https://localhost:5241/`). Click **Connect**.
6.  A new "In development" section will appear, showing your GitExpress add-on. Click it to open the panel.

You are now running GitExpress locally! Any changes you make to the source code will automatically reload the add-on inside Adobe Express.

---

## 🛠️ Core Technologies
* **Framework:** React & TypeScript
* **Platform:** Adobe Express Add-on SDK
* **UI:** Adobe Spectrum Web Components
* **Database:** IndexedDB with Dexie.js
* **Delta Engine:** `fast-json-patch` & `lz4-wasm`
* **Visualization:** Mermaid.js