import Logo from "../assets/Logo.png";

const SplashScreen = () => {
  return (
    <div className="splash">
      <div className="splash__card">
        <img src={Logo} alt="Datanaut logo" className="splash__logo" />
        <p className="splash__text">Preparing your workspace...</p>
      </div>
    </div>
  );
};

export default SplashScreen;
