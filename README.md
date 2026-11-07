[README.md](https://github.com/user-attachments/files/34511051/README.md)
# ChapterLab — starter website

ChapterLab is a beginner-friendly, static JEE practice-test website. It runs in a browser and can be published for other students to use.

## Run it on your computer

1. Download and extract the `chapterlab.zip` file.
2. Open the `chapterlab` folder.
3. Double-click `index.html` to open it in Chrome, Edge or Firefox.
4. No installation, terminal commands, account or payment is required.

Keep `index.html`, `styles.css`, `app.js` and `questions.js` together in the same folder.

## What works in this version

- Physics, Chemistry and Mathematics chapter selection.
- Select a full chapter or individual topics.
- Combine chapters and topics from any of the three subjects.
- Randomly draw questions from the complete selected pool. There is no forced equal chapter split.
- Adjustable question count and timer (0 minutes means untimed).
- Question navigation, answer palette and mark-for-review control.
- JEE-style scoring for this prototype: +4 correct, −1 incorrect, 0 unattempted.
- Score, accuracy, answer review and explanations.
- Light and dark themes.
- Import a JSON question bank for the current browser session.
- Responsive layout for phones and computers.

## Important limitations

- The built-in questions are original demonstration questions, not official JEE Main PYQs.
- The first version is static. All visitors share the same built-in question bank once it is published, but each test runs independently in that visitor's browser.
- Imported JSON questions replace the question bank only in the current browser session. They are not uploaded to the public website and are not shared with other visitors.
- Test answers and result history are not stored in a cloud account. Refreshing or closing the page during a test loses that session.
- There are no user accounts, admin dashboard, cloud database, synced history or leaderboards yet.
- Only single-correct, four-option questions are supported in this starter version.

## Publish it free with GitHub Pages

GitHub Pages can host static files from a public repository on GitHub Free.

1. Create or sign in to a GitHub account.
2. Create a **public** repository, for example `chapterlab`.
3. Extract this ZIP on your computer.
4. Open the repository on GitHub and choose **Add file → Upload files**.
5. Upload the contents of the `chapterlab` folder (not the outer ZIP). Make sure `index.html` is at the top level of the repository.
6. Commit the uploaded files.
7. Open the repository's **Settings → Pages**.
8. Under **Build and deployment**, choose **Deploy from a branch**.
9. Select branch `main` and folder `/(root)`, then save.
10. GitHub will show the published website URL in the Pages section. It usually looks like `https://YOUR-USERNAME.github.io/chapterlab/`.

The repository and Pages site are public. Do not upload passwords, private information or material you do not have permission to publish. You can update the site later by uploading/replacing the files and committing the changes.

Official setup guide: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## Add questions

### Option A — Import a JSON bank to test locally

1. Open the site.
2. Click **Import bank** in the top-right corner.
3. Select a JSON file that follows the format in `question-bank-template.json`.
4. The imported bank replaces the built-in bank only until that page is reloaded.

### Option B — Update the public built-in bank

For the first release, the built-in bank is in `questions.js` in `window.CHAPTERLAB_QUESTIONS`. Add objects using the same fields shown in `question-bank-template.json`, then re-upload/commit the updated `questions.js` file to your public repository. Everyone will see the updated shared bank after deployment.

Use only questions you wrote yourself or are authorised to reproduce and publish. Keep source/attribution details where applicable. Do not assume that a question visible in a coaching app or website can be copied and republished.

### Question format

- `subject`: exactly `Physics`, `Chemistry` or `Mathematics`
- `chapter`: chapter name
- `topic`: topic name
- `question`: question text
- `options`: exactly four strings
- `answer`: correct option index (`0` for A, `1` for B, `2` for C, `3` for D)
- `explanation`: explanation displayed in answer review
- `source`: optional source/attribution label
- `year`: optional year label

## Suggested next version

After the prototype is tested, the next major step is a shared online database plus a protected admin workflow. That would let you update the question bank once and make the changes available to every visitor without editing the code. A backend is also needed for accounts and synced test history. Those features can be added later; they are not needed to publish and test this first version.
