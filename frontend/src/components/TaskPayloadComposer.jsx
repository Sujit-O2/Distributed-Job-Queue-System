function FieldUploadControls({ field, onUpload, uploadState }) {
  if (!field.upload || !onUpload) {
    return null;
  }

  const inputId = `upload-${field.name}`;
  const isMultiple = field.upload.mode === "multiple";
  const status = uploadState?.[field.name];

  return (
    <div className="upload-control">
      <div className="upload-control__row">
        <label className="button button--ghost upload-control__trigger" htmlFor={inputId}>
          {isMultiple ? "Upload Files" : "Upload File"}
        </label>
        <span className="upload-control__hint">
          {field.upload.help || "Stored in the shared uploads folder for the backend and worker."}
        </span>
      </div>

      <input
        id={inputId}
        className="file-picker-input"
        type="file"
        accept={field.upload.accept}
        multiple={isMultiple}
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          if (files.length) {
            onUpload(field, files);
          }
          event.target.value = "";
        }}
      />

      {status ? (
        <p className={`upload-status upload-status--${status.status}`}>
          {status.message}
        </p>
      ) : null}
    </div>
  );
}

function TaskField({ field, value, onChange, onUpload, uploadState }) {
  const spanClass = field.span === 2 ? " field--span-2" : "";

  if (field.type === "checkbox") {
    return (
      <label className={`toggle-field${spanClass}`}>
        <div>
          <span className="field-label">{field.label}</span>
          {field.help ? <span className="field-help">{field.help}</span> : null}
        </div>
        <input
          className="checkbox-input"
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(field.name, event.target.checked)}
        />
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <div className={`field${spanClass}`}>
        <label className="field__control">
          <span className="field-label">{field.label}</span>
          <select
            className="text-input"
            value={value ?? ""}
            onChange={(event) => onChange(field.name, event.target.value)}
          >
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {field.help ? <span className="field-help">{field.help}</span> : null}
        <FieldUploadControls field={field} onUpload={onUpload} uploadState={uploadState} />
      </div>
    );
  }

  if (field.type === "textarea" || field.type === "json") {
    return (
      <div className={`field${spanClass}`}>
        <label className="field__control">
          <span className="field-label">{field.label}</span>
          <textarea
            className={`text-area${field.type === "json" ? " text-area--code" : ""}`}
            rows={field.rows || (field.type === "json" ? 7 : 4)}
            value={value ?? ""}
            placeholder={field.placeholder}
            onChange={(event) => onChange(field.name, event.target.value)}
          />
        </label>
        {field.help ? <span className="field-help">{field.help}</span> : null}
        <FieldUploadControls field={field} onUpload={onUpload} uploadState={uploadState} />
      </div>
    );
  }

  return (
    <div className={`field${spanClass}`}>
      <label className="field__control">
        <span className="field-label">{field.label}</span>
        <input
          type={field.type === "number" ? "number" : "text"}
          step={field.step}
          className="text-input"
          value={value ?? ""}
          placeholder={field.placeholder}
          onChange={(event) => onChange(field.name, event.target.value)}
        />
      </label>
      {field.help ? <span className="field-help">{field.help}</span> : null}
      <FieldUploadControls field={field} onUpload={onUpload} uploadState={uploadState} />
    </div>
  );
}

export function getVisibleTaskSections(schema, values) {
  const visibleFields = schema.fields.filter((field) => !field.when || field.when(values));
  const sectionNames = [];

  visibleFields.forEach((field) => {
    const sectionName = field.section || "Configuration";
    if (!sectionNames.includes(sectionName)) {
      sectionNames.push(sectionName);
    }
  });

  return sectionNames;
}

export function TaskPayloadComposer({
  schema,
  values,
  onChange,
  onUpload = null,
  uploadState = null,
  activeSectionName = null,
  showNote = true,
}) {
  const visibleFields = schema.fields.filter((field) => !field.when || field.when(values));
  const sectionNames = getVisibleTaskSections(schema, values);
  const sectionsToRender = activeSectionName ? sectionNames.filter((name) => name === activeSectionName) : sectionNames;

  return (
    <div className="guided-composer">
      {showNote && schema.note ? <div className="builder-note">{schema.note}</div> : null}

      {sectionsToRender.map((sectionName) => (
        <section key={sectionName} className="composer-section">
          <div className="composer-section__header">
            <p className="eyebrow">Task Inputs</p>
            <h4>{sectionName}</h4>
          </div>

          <div className="field-grid field-grid--guided">
            {visibleFields
              .filter((field) => (field.section || "Configuration") === sectionName)
              .map((field) => (
                <TaskField
                  key={field.name}
                  field={field}
                  value={values[field.name]}
                  onChange={onChange}
                  onUpload={onUpload}
                  uploadState={uploadState}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
