"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { createTicketAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import type { ProjectSummary } from "@/lib/types";

interface ClientNewRequestButtonProps {
  selectedProject: ProjectSummary | null;
}

interface RequestFormValues {
  title: string;
  priority: string;
  description: string;
}

type RequestFormErrors = Partial<Record<keyof RequestFormValues, string>>;

const DEFAULT_FORM_VALUES: RequestFormValues = {
  title: "",
  priority: "MEDIUM",
  description: ""
};

export function ClientNewRequestButton({
  selectedProject
}: ClientNewRequestButtonProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [formValues, setFormValues] = useState<RequestFormValues>(DEFAULT_FORM_VALUES);
  const [errors, setErrors] = useState<RequestFormErrors>({});
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function openModal() {
    setFormValues(DEFAULT_FORM_VALUES);
    setErrors({});
    setIsOpen(true);
  }

  function updateField<K extends keyof RequestFormValues>(field: K, value: RequestFormValues[K]) {
    setFormValues((current) => ({
      ...current,
      [field]: value
    }));

    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validate(values: RequestFormValues) {
    const nextErrors: RequestFormErrors = {};

    if (values.title.trim().length < 3) {
      nextErrors.title = "Enter a title with at least 3 characters.";
    }

    if (values.description.trim().length < 10) {
      nextErrors.description = "Add a description with at least 10 characters.";
    }

    return nextErrors;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const nextErrors = validate(formValues);

    if (Object.keys(nextErrors).length === 0) {
      return;
    }

    event.preventDefault();
    setErrors(nextErrors);

    if (nextErrors.title) {
      titleRef.current?.focus();
      return;
    }

    if (nextErrors.description) {
      descriptionRef.current?.focus();
    }
  }

  return (
    <>
      <button
        className="button button-primary"
        disabled={!selectedProject}
        onClick={openModal}
        type="button"
      >
        New Request
      </button>

      {isMounted && isOpen && selectedProject
        ? createPortal(
            <div
              className="modal-backdrop"
              onClick={() => setIsOpen(false)}
              role="presentation"
            >
              <div
                aria-labelledby="new-request-modal-title"
                aria-modal="true"
                className="ticket-modal ticket-modal--request"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
              >
                <div className="ticket-modal__header">
                  <div>
                    <p className="ticket-modal__eyebrow">{selectedProject.name}</p>
                    <h3 id="new-request-modal-title">New Request</h3>
                  </div>
                  <button
                    aria-label="Close new request modal"
                    className="ticket-modal__close"
                    onClick={() => setIsOpen(false)}
                    type="button"
                  >
                    ×
                  </button>
                </div>

                <form
                  action={createTicketAction}
                  className="stack-form"
                  noValidate
                  onSubmit={handleSubmit}
                >
                  <input name="projectId" type="hidden" value={selectedProject.id} />
                  <input name="redirectTo" type="hidden" value="/dashboard/client" />

                  {Object.keys(errors).length > 0 ? (
                    <div className="request-form__notice" role="alert">
                      Please correct the highlighted fields before submitting.
                    </div>
                  ) : null}

                  <label className="field">
                    <span>Project</span>
                    <input readOnly value={selectedProject.name} />
                  </label>

                  <label className="field">
                    <span>Title</span>
                    <input
                      aria-describedby={errors.title ? "request-title-error" : undefined}
                      aria-invalid={Boolean(errors.title)}
                      name="title"
                      onChange={(event) => updateField("title", event.target.value)}
                      placeholder="Homepage button alignment issue"
                      ref={titleRef}
                      required
                      value={formValues.title}
                    />
                    {errors.title ? (
                      <span className="field__error" id="request-title-error" role="alert">
                        {errors.title}
                      </span>
                    ) : null}
                  </label>

                  <label className="field">
                    <span>Priority</span>
                    <select
                      name="priority"
                      onChange={(event) => updateField("priority", event.target.value)}
                      value={formValues.priority}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Description</span>
                    <textarea
                      aria-describedby={errors.description ? "request-description-error" : undefined}
                      aria-invalid={Boolean(errors.description)}
                      name="description"
                      onChange={(event) => updateField("description", event.target.value)}
                      placeholder="Describe the request, what you expected, and any relevant links."
                      ref={descriptionRef}
                      required
                      rows={6}
                      value={formValues.description}
                    />
                    {errors.description ? (
                      <span className="field__error" id="request-description-error" role="alert">
                        {errors.description}
                      </span>
                    ) : null}
                  </label>

                  <SubmitButton label="Submit ticket" pendingLabel="Submitting..." />
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
