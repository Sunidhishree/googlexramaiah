import AnimatedList from './AnimatedList';

const ProgramsDropdown = () => {
  const items = ['Orphanage Activities', 'Elara'];

  const handleSelect = (item) => {
    const path = item.toLowerCase().replace(/ /g, '-');
    window.location.pathname = `/programs/${path}`;
  };

  return (
    <AnimatedList
      items={items}
      onItemSelect={(item) => handleSelect(item)}
      showGradients={true}
      enableArrowNavigation={true}
      displayScrollbar={true}
    />
  );
};

export default ProgramsDropdown;
