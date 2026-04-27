for development workflow / orchestractor / supervisor pattern
- implement a developer review pattern as supervisor skill
- spin up an agent context that contains recent changes and context about the changes (i.e. task definitions, feature description, etc)
- supervisor spins up a worker, gives it the context
- worker asks ONCE for feedback,
- dev provides feedbaack
- worker implements the feedback
- worker gets back to the supervisor with a brief summary about the changes
- supervisor continues starts the next "feedback worker" with all previous + additional context


=> productive peer review without the need to provide all the context each time and also without running out of context when reviewing code with the agents