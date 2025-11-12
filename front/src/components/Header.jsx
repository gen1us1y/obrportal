import { Link } from 'react-router-dom'

export default function Header() {

  return (
    <header className="header">
      <div className="header__container">

        <nav className="header__nav">
          <Link to="/">Главная</Link>
          </nav>
        </div>
    </header>
  )
}
