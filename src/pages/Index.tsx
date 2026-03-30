import { useEffect } from "react";

const Index = () => {
  useEffect(() => {
    window.location.href = "/argus/index.html";
  }, []);

  return null;
};

export default Index;
