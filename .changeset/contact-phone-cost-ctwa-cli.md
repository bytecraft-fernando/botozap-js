---
"@botozap/cli": minor
---

`contacts create`/`contacts update` accept `--display-name`, and `contacts update --clear-display-name` removes it. New `numbers update <id> --label <name>` (or `--clear-label`) and `usage meta-costs [--customer-id] [--from] [--to]`, which prints missing Meta cost as "indisponível", never 0. `numbers list` shows the label and the connection status (the status column used to read a field the API does not return), and `conversations list` shows contact, origin (`entry_point`) and last message time.
