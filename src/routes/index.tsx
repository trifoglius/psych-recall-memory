import { createFileRoute } from '@tanstack/react-router'
import FreeRecallTask from '../components/FreeRecallTask'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return <FreeRecallTask />
}
