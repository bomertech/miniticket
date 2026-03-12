"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { selectProjectAction } from "@/app/actions";
import type { ProjectSummary } from "@/lib/types";

interface ClientProjectToolbarProps {
  projects: ProjectSummary[];
  selectedProjectId: number | null;
}

export function ClientProjectToolbar({
  projects,
  selectedProjectId
}: ClientProjectToolbarProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState(selectedProjectId ?? projects[0]?.id ?? null);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null,
    [activeProjectId, projects]
  );

  useEffect(() => {
    setActiveProjectId(selectedProjectId ?? projects[0]?.id ?? null);
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (projects.length === 0) {
    return <p className="toolbar-project-empty">No active projects</p>;
  }

  function selectProject(projectId: number) {
    if (inputRef.current) {
      inputRef.current.value = String(projectId);
    }

    setActiveProjectId(projectId);
    setIsOpen(false);
    formRef.current?.requestSubmit();
  }

  return (
    <form action={selectProjectAction} className="toolbar-project-selector" ref={formRef}>
      <input
        name="projectId"
        ref={inputRef}
        type="hidden"
        value={activeProject?.id ?? ""}
        readOnly
      />
      <div className="toolbar-project-dropdown" ref={containerRef}>
        <button
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className="toolbar-project-trigger"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <span className="toolbar-project-trigger__label">
            {activeProject?.name ?? "Select project"}
          </span>
          <span aria-hidden="true" className="toolbar-project-trigger__chevron">
            {isOpen ? "▴" : "▾"}
          </span>
        </button>

        {isOpen ? (
          <div className="toolbar-project-menu" role="listbox">
            {projects.map((project) => {
              const isSelected = project.id === activeProject?.id;

              return (
                <button
                  aria-selected={isSelected}
                  className="toolbar-project-option"
                  key={project.id}
                  onClick={() => selectProject(project.id)}
                  role="option"
                  type="button"
                >
                  <span>{project.name}</span>
                  {isSelected ? (
                    <span aria-hidden="true" className="toolbar-project-option__check">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </form>
  );
}
