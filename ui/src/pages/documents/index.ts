import type { ComponentType } from "react";
import type { DocPageProps } from "./_shared";

import WhatIs from "./what-is";
import Architecture from "./architecture";
import KeyConcepts from "./key-concepts";
import Pricing from "./pricing";

import Quickstart from "./quickstart";
import Installation from "./installation";
import Configuration from "./configuration";

import Staff from "./staff";
import Skills from "./skills";
import Departments from "./departments";
import Tasks from "./tasks";
import Projects from "./projects";
import Recruiting from "./recruiting";
import Connections from "./connections";
import Meetings from "./meetings";
import Playground from "./playground";
import Analytics from "./analytics";
import Companies from "./companies";
import Settings from "./settings";

import GuideFirstStaff from "./guide-first-staff";
import GuideBuildDepartment from "./guide-build-department";
import GuideRunTask from "./guide-run-task";
import GuideSkills from "./guide-skills";

import ApiStaff from "./api-staff";
import ApiSkills from "./api-skills";
import ApiDepartments from "./api-departments";
import ApiTasks from "./api-tasks";
import ApiChat from "./api-chat";

import DeployDocker from "./deploy-docker";
import DeployEnv from "./deploy-env";

import ContributingGuide from "./contributing-guide";
import ContributingDev from "./contributing-dev";

export type { DocPageProps };

// Doc page id -> component. Docs.tsx renders DOCS_PAGES[activeId] with the
// current UI language; every page writes its own full content per language
// (no locale-file lookups).
export const DOCS_PAGES: Record<string, ComponentType<DocPageProps>> = {
  "what-is": WhatIs,
  "architecture": Architecture,
  "key-concepts": KeyConcepts,
  "pricing": Pricing,

  "quickstart": Quickstart,
  "installation": Installation,
  "configuration": Configuration,

  "staff": Staff,
  "skills": Skills,
  "departments": Departments,
  "tasks": Tasks,
  "projects": Projects,
  "recruiting": Recruiting,
  "connections": Connections,
  "meetings": Meetings,
  "playground": Playground,
  "analytics": Analytics,
  "companies": Companies,
  "settings": Settings,

  "guide-first-staff": GuideFirstStaff,
  "guide-build-department": GuideBuildDepartment,
  "guide-run-task": GuideRunTask,
  "guide-skills": GuideSkills,

  "api-staff": ApiStaff,
  "api-skills": ApiSkills,
  "api-departments": ApiDepartments,
  "api-tasks": ApiTasks,
  "api-chat": ApiChat,

  "deploy-docker": DeployDocker,
  "deploy-env": DeployEnv,

  "contributing-guide": ContributingGuide,
  "contributing-dev": ContributingDev,
};
