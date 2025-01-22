# Argo?

## Setup

**this is unverified, but seems right**

- You need an `origin` git remote of the Mozilla Mercurial repo, along with whatever remote you're using for this fork repo:
  ```
  origin  hg::https://hg.mozilla.org/mozilla-unified (fetch)
  origin  hg::https://hg.mozilla.org/mozilla-unified (push)
  opfn    git@github.com:operating-function/gecko-dev.git (fetch)
  opfn    git@github.com:operating-function/gecko-dev.git (push)
  mozilla git@github.com:mozilla/gecko-dev.git (fetch)
  mozilla git@github.com:mozilla/gecko-dev.git (push)
  ```
  - You probably need to follow the directions Mozilla provides in general first, including having a `git cinnabar` installation working. (https://firefox-source-docs.mozilla.org/contributing/contribution_quickref.html)
  - We have a `mozilla-central` branch which is based off of the _gecko-dev_ readonly git mirror's `master`. This seems to track the `mozilla-unified` repo's `bookmarks/central` branch.
  - For the sake of our purposes here, consider our `mozilla-central` branch to be "master", I suppose.
  - We should attempt to keep our `mozilla-central` branch reasonably up-to-date with the upstream; or else lock to a version for now and push off the daunting task of keeping our fork updated...
- Once you have an `origin` remote and a local `gecko-dev` mirror, you should be able to `./mach build` from the root of this repo. The build process seems to require having the Mercurial `origin` present.

---

# `README.txt` From original fork:

An explanation of the Firefox Source Code Directory Structure and links to
project pages with documentation can be found at:

    https://firefox-source-docs.mozilla.org/contributing/directory_structure.html

For information on how to build Firefox from the source code and create the patch see:

    https://firefox-source-docs.mozilla.org/contributing/contribution_quickref.html

If you have a question about developing Firefox, and can't find the solution
on https://firefox-source-docs.mozilla.org/, you can try asking your question on Matrix at chat.mozilla.org in `Introduction` (https://chat.mozilla.org/#/room/#introduction:mozilla.org) channel.


Nightly development builds can be downloaded from:

    https://archive.mozilla.org/pub/firefox/nightly/latest-mozilla-central/
            - or -
    https://www.mozilla.org/firefox/channel/desktop/#nightly

Keep in mind that nightly builds, which are used by Firefox developers for
testing, may be buggy.
