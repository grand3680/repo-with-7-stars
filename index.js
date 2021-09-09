const core = require("@actions/core")
const github = require("@actions/github")

function toOrd(n) {
  const s = ["th", "st", "nd", "rd"],
        v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

async function run() {
  try {
    const githubToken = core.getInput("githubToken")
    const actor = core.getInput("actor") || ""
    const octokit = github.getOctokit(githubToken)
    const username = "Tegnio"

    let filteredRepos = []

    let page = 1
    while (true) {
      const repos = await octokit.request("GET /users/{username}/repos", {
        username,
        type: "public",
        page,
        per_page: 100,
        mediaType: {
          previews: ["mercy"],
        },
      })

      page += 1

      if (repos.data.length === 0) {
        break
      }

      const data = repos.data.map((repo) => ({
        name: repo.name,
        full_name: repo.full_name,
        stargazers_count: repo.stargazers_count,
      }))

      filteredRepos = filteredRepos.concat(
        data.filter((repo) => repo.name.includes("repo-with-"))
      )
    }

    filteredRepos.forEach(async ({ full_name, stargazers_count }) => {
      const [owner, repo] = full_name.split("/")
      const name = `repo-with-${stargazers_count}-stars`
      const title = `A repository with ${stargazers_count} stars 🤩`
      const msg = `[${actor}](https://github.com/${actor}) gave this repository ${toOrd(stargazers_count)} star, thanks a lot for your support!`

      // Break if repo name is not updated
      if (repo == name) { return }

      await octokit.request("PATCH /repos/{owner}/{repo}", {
        owner,
        repo,
        name,
      })

      console.log(`Repo name updated to ${name}`)

      const readmeFile = await octokit.request(
        "GET /repos/{owner}/{repo}/contents/{path}",
        {
          owner,
          repo,
          path: "README.md",
        }
      )

      const readmeContents = [
        "Note: the idea was adapted from [narze's](https://github.com/narze) repository.",
        `# ${title}`,
        msg,
        "## The star count is wrong?",
        "Then help me fix it, star this repo!",
      ]

      await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
        owner,
        repo,
        path: "README.md",
        message: `${toOrd(stargazers_count)} star 🤩`,
        content: Buffer.from(readmeContents.join("\n\n")).toString("base64"),
        sha: readmeFile.data.sha,
        author: {
          name: actor,
          email: `${actor}@users.noreply.github.com`,
        },
        committer: {
          name: "Tegnio's soulless machine",
          email: "Tegnio@users.noreply.github.com",
        },
      })
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
