# Notice

**GOwift** — Copyright (C) 2026 [rgvduarte](https://github.com/rgvduarte),
owner and developer of GOwift.

GOwift is a fork of **OpenRadlr**
(<https://github.com/Lethonium/OpenRadlr>), forked from commit
[`2b09a79`](https://github.com/Lethonium/OpenRadlr/commit/2b09a79b34b8fb0d2f7c81d3a7acb150b8e23190)
(November 2026). Copyright (C) The OpenRadlr contributors.

The full OpenRadlr history is part of this repository, so `git log` and
`git blame` show who wrote what.

## Licences

- **Code** (OpenRadlr's and GOwift's): GNU Affero General Public License,
  version 3 or later ([LICENSE](LICENSE)). The upstream copyright notices stay
  in force; GOwift's changes are released under the same licence.
- **Artwork**: CC BY-SA 4.0, see [ASSETS-LICENSE.md](ASSETS-LICENSE.md) for
  which files come from OpenRadlr and which are GOwift's own.

## What changed in the fork

- New name, identifiers and branding: the product, crates, environment
  variables (`GOWIFT_*`), metrics, app IDs and storage keys are called GOwift.
- New logo, icons and colours. The OpenRadlr name and lemon logo are not used
  as GOwift's brand ([TRADEMARKS.md](TRADEMARKS.md)).
- A GitHub Pages site for the landing page.

GOwift is not affiliated with or endorsed by the OpenRadlr project.

## Running a modified GOwift server

GOwift is a modified version of OpenRadlr, so the AGPL's section 13 applies
to anyone who runs it for others over a network: they must offer those riders
the Corresponding Source. The start menu's *Source code (AGPL-3.0)* link does
that for this repository. If you run a further-changed version, point that
link (`client/public/index.html`, `#source-link`) at your own source.

## Third-party data

- Lanzarote Lava 180 (`routes/lanzarote-lava-180.json`): road geometry
  © OpenStreetMap contributors, ODbL; elevation: Copernicus DEM GLO-30
  © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided
  under COPERNICUS by the European Union and ESA. The credit is in the route's
  description, shown in the start menu, and in [docs/routes.md](docs/routes.md).
