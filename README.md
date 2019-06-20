# manifest-js

A tool for people who work with many repositories. One manifest to rule them all.

Checkout specific tags, branches, or commits from multiple repositories into
locations specified in a manifest file. Create and merge branches in a set
of repositories with one command.

The `manifest` tool is written in JavaScript and packaged with `npm`.

Why use `manifest`? You might be interested in this tool if:

* your code is in multiple repositories
* it's tedious to create, merge, and delete branches in each repository
* you want to easily identify related work across multiple repositories
* you need an easier way to share the list of repositories and which branch to check out in each one
* sometimes you work with a subset of repositories

Maybe you've been posting a list of repositories somewhere manually and it's
tedious to maintain or keeps getting outdated because it's not being maintained.
There's a manifest tool for that :)

*** IMPORTANT NOTE *** 

This code is still under development and is not yet suitable for regular use.

# Pre-requisites

* NodeJS
* NPM

# Installation

```
npm install -g @jbuhacoff/manifest
```

# Getting started

You just started working on a project and you need to clone all the 
relevant repositories and checkout the code in each repository that
corresponds to the current development branch.

Create a workspace directory. For example:

```
mkdir workspace && cd workspace
```

In scripts below we will refer to this workspace directory as `$WORKSPACE_PATH`.

Someone who is already working on the project gives you the URL to the
manifest repository and tells you that you'll need to checkout the `current`
repository set from which to create your own feature branch.

Let's define these for this example:

```
MANIFEST_URL=git+ssh://example.com/manifest-repository
MANIFEST_REF=current
```

See usage information:

```
manifest --help
manifest --help <command>
```


# Command

## Add

The repository must already be checked out and stored
in the workspace. This command will add it to the manifest in its current state.

`manifest add <path relative to workspace>`

Command behavior:

Edits `.manifest/ref/$MANIFEST_REF.yaml` to add the repository path relative to the workspace,
and the current tag, branch, or commit id. If there is a tag pointing to the current
commit id, it will be used. Otherwise the current branch will be used. Otherwise
the current commit id will be used. If the repository is already configured to pull
from a remote url, the url is added to the manifest. If the repository has multiple
remotes, and one of them is named 'origin', that remote is used automatically as the
repository url. If it has multiple remotes, and none of them are named origin, a
warning is emitted. 


## Branch

```
manifest branch <name>
```

Command behavior:

Create a new manifest `<name>`. 

Create a branch named `<name>` in each repository listed in the `$MANIFEST_REF`
manifest.

If `<name>` starts with `+`, prepends current ref (branch name or commit) to
create a branch name like `{current}+{name}`. 
For example,
if repository A is on branch `v1.0+next`, and if
repository B is on branch `master`, and
the name specified in the command is `+feature#1234-short-title` the
branch name in A will be `v1.0+next+feature#1234-short-title`, while the branch 
name in B will be `master+feature#1234-short-title`. 

## Checkout

`manifest checkout <ref>`

Command behavior:

When you are switching from working on feature 1 to feature 2, this command will
checkout all the repositories to the tag, branch, or commit id that is needed for
feature 2. If you have any unsaved work in feature 1 it will be automatically stashed.

Git doesn't allow checking out a tag directly -- you have to create a branch because
the tag is not editable. The tool automatically creates a branch named `{tag}+next`.
If the repository is configured to point to a specific commit in the manifest, a new
branch will automatically be created `{commit}+next`.

When you switch from feature 2 to feature 1, if there is a stash on feature 1 it
will be automatically restored and a notice will be displayed.
Otherwise the feature 1 repository set will be checked
out according to the `$MANIFEST_REF`.

## Create

To capture the current state of all the repositories in the workspace, use this
command.

`manifest create <ref>`

The file `.manifest/ref/<ref>.yaml` must not already exist. 

Command behavior:

Creates `.manifest/ref/<ref>.yaml` to add the repository path relative to the workspace
and the current tag, branch, or commit id. If there is a tag pointing to the current
commit id, it will be used. Otherwise the current branch will be used. Otherwise
the current commit id will be used.

Warns if `.manifest/ref/<ref>.yaml` is missing a remote definition for any repository.

Immediately commits and pushes the manifest repository so the change is visible
to others. This prevents naming conflicts by reserving the name `<ref>`.

## Delete

To delete an existing manifest, use this command.

`manifest delete <ref>`

The file `.manifest/ref/<ref>.yaml` must exist to be deleted.

Command behavior:

Emits an error message and exits with non-zero code if `<ref>` does not exist.

Deletes the specified manifest. Does not affect any repositories.

Immediately commits and pushes the manifest repository so the change is visible
to others. This prevents others from starting new work based on `<ref>` and also
frees up the `<ref>` name to be reused.

## Exec

This command executes a specified command in each repository listed in the manifest.

`manifest exec git commit -m <message>`

This would execute the command `git commit -m <message>` in each repository listed
in the manifest. It might be appropriate for housekeeping tasks like doing a similar
fix in each repository. 

`manifest exec git pull`

This would execute the command `git pull` in each repository listed in the manifest.

## Init

```
manifest init .
manifest init <url>
```

Command behavior: 

The command `manifest init .` will initialize the manifest using the content of the
current directory. Note that you cannot use any other directory path instead of `.` 
because the manifest is created in your workspace which is assumed to be the
current directory, and all repositories are required to be at a path relative to
the workspace. This makes the manifest reusable by many people who may clone the
entire workspace into any directory they want.

All the repositories specified by the manifest file at `<url>` will be cloned
into the current directory, which
is the workspace directory `$WORKSPACE_PATH`. If any repository is unreachable
an error will be emitted.

## Merge

`manifest merge <ref>`

Command behavior:

For each repository in the manifest, attempt to merge the tag, branch, or commit id
for this repository in the
specified `<ref>` into the current branch. If merge is not
successful, store the git output in a file in each repository so it can be inspected,
and emit an error message.

NOTE: you should first run `manifest status` to make sure all repositories are ready for a merge
with no untracked changes.

NOTE: if the specified `<ref>` manifest has repositories that the current one doesn't, those
will be added automatically if possible.

## Status

`manifest status`

Command behavior:

For each repository in the manifest, check if there are any uncommitted changes in that repository.

The status report is in Markdown format:

```
---
title: Manifest status report for: {manifest}
---

# path/to/repo1

<info>

# path/to/repo2

<info>
```

# Procedure

## Creating a workspace

A workspace is just a directory where you will have a manifest and repositories.

You could create multiple workspaces, such as `~/project1` and `~/project2` so that
you can have multiple copies of repositories checked out to different branches
concurrently. If your IDE has a workspaces feature, this makes it convenient to close
all repositories from one workspace and open all repositories from another workspace
with one command.

## Initialize a workspace

To get a copy of all the relevant repositories and checkout the appropriate
branch in each one according to a prefdefined repository set, you only 
need one command:

```
manifest init $MANIFEST_URL
```

To initialize a workspace using repositories already checked out:

```
manifest init .
```

Note that the `.` is a special case. You cannot use a path to any other directory here.

## Preparing to initialize a workspace

Someone needs to post a file at a URL for the `manifest init` command to download.

That file needs to mention each repository to checkout and the URL for that
repository. It's convenient to keep this file also as part of a source repository,
so it can be maintained and shared easily.

## Adding a repository

The repository must already be checked out and stored
in the workspace. This command will add it to the manifest in its current state.

`manifest add <path relative to workspace> [--ref <ref>]`

## Creating a feature branch

To start working on a new feature, you need to create a corresponding branch
in each repository. Without the manifest tool, it could be tedious to do that
and you'd try to limit the effort to only repositories where you're about to 
edit files, and the name of the branch in some repositories might be inconsistent
with the others. Using the manifest tool, the branch is created in every
repository and when you share with others they will get the same view. When it's
time to clean up the feature (merge into main development branch and delete it)
this is also automatic across all repositories in the manifest. Repositories that
were not edited will not have any merge issues and the feature branch will be
easily deleted when it's time to cleanup.

```
manifest create <ref>
manifest branch <name>
```

For example:

```
manifest create feature#1234
manifest branch feature#1234-short-title
```

To name the feature branch using a `{current}+{branch}` convention in each 
repository, use a `+` at the start of the branch name like this:

```
manifest branch +feature#1234-short-title
```

For example, if repository A is on branch `master` and repository B is on 
branch `v1.0+next`, the command `manifest branch +feature#123` will create branch
`master+feature#123` in repository A and branch `v1.0+next+feature#123` in 
repository B.

## Updating repositories

To keep your branches up to date with remote changes, you could run `git pull`
in each repository like this:

```
manifest exec git pull
```

## Commiting changes to repositories

The manifest tool does not commit changes for you. The changes in each repository may
be of different nature and scope. It does provide a way to automate making a similar
commit in each repository via the `exec` command, which should be used very carefully:

`manifest exec git commit -m <message>`

This would execute the command `git commit -m <message>` in each repository listed
in the manifest. It might be appropriate for housekeeping tasks like doing a similar
fix in each repository. 

## Using local repositories

If you are using source control with a project that is not yet shared anywhere, you can 
define repositories in `src` and skip the `io` definitions. Commands that interact with
remote servers will either not work or emit warnings that `io` definitions are missing.

## Synchronizing manifests

It's recommended to keep the manifest repository itself always on the `master` branch so
it can be used for immediate sharing of newly created or deleted manifest names with the
team. 

