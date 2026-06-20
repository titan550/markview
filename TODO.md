6. why are we changing everything to svg? why not use the standard markdown renderer?
7. Add line numbers to the markdown editor
8. Move button to copy markdown to the markdown section and copy html to html. use the copy icon (src/assets/copy.svg) - move to a more appropriate path if applicable

- QR codes are too many. what kind of compression are we using? Can we push the boundaries and test what's max compression we can use?
- copying multiple files doesn't work. it doesnt work if there is text and image combined
- use system settings for dark / light mode
- convert csv/tsd to table (default has header unless turned off)
  `csv {header=false}`
- code must have line numbers
- for pasting html, we should have a config to copy as single cell table or not/ all configs / magic numbers should be in a config saved in user storage
- qr codes look ugly and unrelated to the diagrams
- qr codes are only for diagrams not for math. math gets lost. it copies as html and visible but can't be reversed
- evaluate and potentially add syncing the html rendering to the editor section. that is, if I scroll down, it should fully scroll down

- upgrade to use this editor: https://github.com/nhn/tui.editor
