# 2. The Gherkin Document Model

## 2.1 Block types

A Gherkin document is composed of typed blocks. Keyword blocks have a keyword prefix and free-form text. The valid keyword types are:

| Type       | Keyword prefix |
|------------|----------------|
| feature    | Feature        |
| rule       | Rule           |
| background | Background     |
| scenario   | Scenario       |
| given      | Given          |
| when       | When           |
| then       | Then           |
| and        | And            |
| but        | But            |

In addition, documents may contain **image blocks**. An image block carries an embedded image (stored as a base64 data-URI) and an alt-text string. Image blocks carry no Gherkin step semantics — they are not subject to `canFollow()` rules and may appear after any keyword block.

Documents may also contain **data table blocks**. A data table block carries a 2D array of string cells (rows × columns). Data table blocks carry no Gherkin step semantics — they are not subject to `canFollow()` rules. A data table may appear immediately after any step block (`given`, `when`, `then`, `and`, `but`) or after another data table; placement is enforced in the editor layer.

---

## 2.2 Document structure rules

These rules govern which block type may follow another. They are enforced by `canFollow()` in `src/lib/gherkin.ts` and apply everywhere in the application — editor toolbar, slash-command menu, and Enter-key auto-progression.

**Given** the document is empty  
**Then** the only valid first block type is `feature`

**Given** the current block is `feature`  
**Then** the valid next block types are: `rule`, `background`, `scenario`

**Given** the current block is `rule`  
**Then** the valid next block types are: `background`, `scenario`

**Given** the current block is `background`  
**Then** the only valid next block type is `given`

**Given** the current block is `scenario`  
**Then** the only valid next block type is `given`

**Given** the current block is `given`  
**Then** the valid next block types are: `when`, `and`, `but`

**Given** the current block is `when`  
**Then** the valid next block types are: `then`, `and`, `but`

**Given** the current block is `then`  
**Then** the valid next block types are: `and`, `but`, `given`, `scenario`, `rule`

**Given** the current block is `and`  
**Then** the valid next block types are: `given`, `when`, `then`, `and`, `but`, `scenario`, `rule`

**Given** the current block is `but`  
**Then** the valid next block types are: `given`, `when`, `then`, `and`, `scenario`, `rule`
