Read @AGENTS.md completely. You're working on beads issue {{ISSUE_ID}} Your job is to implement that issue.

Do the following:

0. Run "bun run dev:all" in the background so you can access logs.
1. Implement the issue
2. Ensure all tests, lint, formatting, and build succeeds
3. verify the app meets the A/C in the issue by ensuring that you've written the necessary, applicable, and proper unit, integration, and e2e tests
4. manually verify and test the issue against the A/C like a human would. you should have all the tools necessary to investigate the situation including playwright mcp and the logs from running the background process.
5. mark the issue as complete
6. commit the changes using conventional commit messaging
7. Kill the background process you started in step 0
