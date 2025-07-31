# PR Code Review

Perform a code review on PR #$ARGUMENTS. You are to spawn 5 subtasks each with a focus on a certain aspect of the
review (descriptions of each task below). If a task finds a potential issue, it MUST add a "REVIEW: " comment at the
location of the issue so it can be reviewed by a human. Once all tasks have completed, please provide an overview
summary of the review.

If no code was changed that applies to a review task, that task may skip review.

## Task reviewer 1: The Architectural Expert

The Architectural Expert is highly skilled at design principles and organizing code. Look for consistency of code and
overall design, especially compared to similar exisiting code in the application. Best practices are important to
follow, especially those around Elixir and Phoenix LiveView applications. If external libraries are used in the PR code,
ensure that they are used properly and consistently with the existing app. Propose improvements and review for security
concerns and performance issues.

Look for opportunites to reduce code duplication, simplify code, and extract common functionality.

Think very hard (Ultrathink) about the architecture.

## Task reviewer 2: The LiveView Expert

This application uses Phoenix LiveView. It is the LiveView Expert's job to ensure that the code follows best practices with the
current version of LiveView.

You should review the current LiveView docs by reading this before beginning:
https://hex2txt.fly.dev/phoenix_live_view/llms.txt.

Things to look out for are:

1. Proper use of mount and handle_params. Note that mount is called twice, so try to avoid double loading of data.
2. Loading any API requests or large queries with async_assign
3. Not including too many unrelated functions in the LiveView, but extracting them to a context or helper module
4. Using function components rather than helper functions
5. Proper naming of modules
6. Consistency with existing LiveView code, particularly Core modules

Specifically in LiveView templates (HEEX) you should look out for:

1. Extracting complex logic and sections to function components
2. Avoiding nested `if` statements if possible
3. Avoiding `cond` and `case` in templates (can it be addressed by function component and pattern matching?)
4. Using `:if` and `:for` where appropriate
5. Using `~p` for verified routes
6. Proper use of components (for example, using the `flop_table` component's `empty_state` slot rather than custom empty
   state code)
7. Good HTML usage and general hygiene
8. Using tailwind classes without redundant options (for example, specifiying a value that is already the default)
9. Avoid using the `@foo && "this" || "that"` and prefer `if @foo, do: "this", else: "that"`

## Task reviewer 3: The Ecto and Context Expert

It is the job of the Ecto and Context Expert to identify potential issues with changes to the data layer of the
application. The application uses Ecto and contexts to interface with data. Ensure the schemas are complete, well
designed, and include proper validations and changesets for correct and optimal use. Ensure contexts are well-bounded
and well-designed for consistent use in the app.

Additionally, check any migrations and ensure there are proper names, defaults, foreign keys, and indexes. Ensure we use
utc_datetime timestamps.

You should always review the current Ecto documentation before beginning review: https://hex2txt.fly.dev/ecto/llms.txt

Things to look out for are:

1. Proper use of schema defaults
2. Correct naming and options on associations
3. Changesets with minimal casted fields (e.g. do not include deleted_at if there is a delete changeset)
4. Thorough and correct validations in create and update changesets
5. Avoid duplication in validations by extracting them to private functions where appropriate
6. Attempt to avoid slow and complex database queries in validations
7. Optimize queries with joins and other techniques where possible

Think very hard (Ultrathink) about the Ecto design and usage.

## Task reviewer 4: The Testing Expert

It is the job of the Testing Expert to evaluate tests (or lack of tests) included in the PR. Tests are extremely
important to prove functionality and to avoid regressions in the future. Tests should be consistent across the
application as much as possible. Tests should not be duplicated excessively and if two tests are very similar and have
only minor differences, consider merging the two with multiple assertions. Identify missing tests.

Think hard.

## Task reviewer 5: The Javascript Expert

The Javascript Expert is the reviewer for any Javascript code in the application that may have changed. The application
contains vanilla JS code, LiveView JS Hooks, AlpineJS (with alpine attributes in the HEEX templates), and Svelte
(through LiveSvelte). Propose improvements based on best practices and look for potential issues.
