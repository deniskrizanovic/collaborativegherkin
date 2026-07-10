# gherkin-document-model Specification

## Purpose

The typed block model of a Gherkin document and the structural rules governing
which block type may follow another. These rules are enforced by `canFollow()`
in `src/lib/gherkin.ts` and apply everywhere: editor toolbar, slash-command
menu, and Enter-key auto-progression.

## Requirements

### Requirement: Block types

A Gherkin document SHALL be composed of typed blocks. Keyword blocks have a
keyword prefix and free-form text; the valid keyword types are `feature`,
`rule`, `background`, `scenario`, `given`, `when`, `then`, `and`, and `but`.
Documents MAY also contain image blocks (an embedded base64 data-URI plus
alt text) and data table blocks (a 2D array of string cells). Image and data
table blocks carry no Gherkin step semantics and are NOT subject to
`canFollow()` rules. An image block MAY appear after any keyword block. A data
table block MAY appear immediately after any step block (`given`, `when`,
`then`, `and`, `but`) or after another data table; placement is enforced in the
editor layer.

#### Scenario: Keyword, image, and data table blocks compose a document
> **Tests:** none (block model exercised indirectly via editor/import/export tests)
- **GIVEN** a document is constructed from blocks
- **THEN** each keyword block is one of `feature`, `rule`, `background`, `scenario`, `given`, `when`, `then`, `and`, `but`
- **AND** image blocks and data table blocks may also appear, carrying no step semantics and exempt from `canFollow()`

### Requirement: Document structure rules

The block type that may follow the current block SHALL be determined by
`canFollow()` in `src/lib/gherkin.ts`, applied consistently across the editor
toolbar, slash-command menu, and Enter-key auto-progression.

#### Scenario: Empty document — only feature allowed
> **Tests:** none (enforced indirectly via toolbar/picker/progression tests)
- **GIVEN** the document is empty
- **THEN** the only valid first block type is `feature`

#### Scenario: After feature — rule, background, scenario allowed
> **Tests:** none (enforced indirectly via toolbar/picker/progression tests)
- **GIVEN** the current block is `feature`
- **THEN** the valid next block types are `rule`, `background`, `scenario`

#### Scenario: After rule — background, scenario allowed
> **Tests:** none (enforced indirectly via toolbar/picker/progression tests)
- **GIVEN** the current block is `rule`
- **THEN** the valid next block types are `background`, `scenario`

#### Scenario: After background — only given allowed
> **Tests:** none (enforced indirectly via toolbar/picker/progression tests)
- **GIVEN** the current block is `background`
- **THEN** the only valid next block type is `given`

#### Scenario: After scenario — only given allowed
> **Tests:** none (enforced indirectly via toolbar/picker/progression tests)
- **GIVEN** the current block is `scenario`
- **THEN** the only valid next block type is `given`

#### Scenario: After given — when, and, but allowed
> **Tests:** none (enforced indirectly via toolbar/picker/progression tests)
- **GIVEN** the current block is `given`
- **THEN** the valid next block types are `when`, `and`, `but`

#### Scenario: After when — then, and, but allowed
> **Tests:** none (enforced indirectly via toolbar/picker/progression tests)
- **GIVEN** the current block is `when`
- **THEN** the valid next block types are `then`, `and`, `but`

#### Scenario: After then — and, but, given, scenario, rule allowed
> **Tests:** none (enforced indirectly via toolbar/picker/progression tests)
- **GIVEN** the current block is `then`
- **THEN** the valid next block types are `and`, `but`, `given`, `scenario`, `rule`

#### Scenario: After and — given, when, then, and, but, scenario, rule allowed
> **Tests:** none (enforced indirectly via toolbar/picker/progression tests)
- **GIVEN** the current block is `and`
- **THEN** the valid next block types are `given`, `when`, `then`, `and`, `but`, `scenario`, `rule`

#### Scenario: After but — given, when, then, and, scenario, rule allowed
> **Tests:** none (enforced indirectly via toolbar/picker/progression tests)
- **GIVEN** the current block is `but`
- **THEN** the valid next block types are `given`, `when`, `then`, `and`, `scenario`, `rule`
