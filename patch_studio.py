"""Fix the StudioPage props to match the component's expected interface."""
path = r"T:\jagan\Python\Project\Distributed Job Queue System\frontend\src\App.jsx"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_studio_call = '''<TaskStudioPage createMutation={createMutation}
                  uploadMutation={uploadMutation} activeUserId={activeUserId} />'''

new_studio_call = '''<StudioPage
                  highlightedTemplate={highlightedTemplate}
                  highlightedTaskForm={highlightedTaskForm}
                  payloadPreview={payloadPreview}
                  selectedTaskType={selectedTaskType}
                  onTemplateChange={setSelectedTaskType}
                  jobDraft={jobDraft}
                  setJobDraft={setJobDraft}
                  onPayloadFieldChange={(f, v) => setJobDraft({ ...jobDraft, payloadForm: { ...jobDraft.payloadForm, [f]: v } })}
                  onPayloadOverrideToggle={() => setJobDraft({ ...jobDraft, payloadOverrideEnabled: !jobDraft.payloadOverrideEnabled })}
                  activeUserId={activeUserId}
                  createJobMutation={createJobMutation}
                  composerError={composerError}
                  onSubmit={handleCreateJob}
                />'''

if old_studio_call in content:
    content = content.replace(old_studio_call, new_studio_call)
    print("Fixed StudioPage props")
else:
    print("ERROR: Could not find StudioPage call to fix")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
