import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { VerticalTimeline, VerticalTimelineElement } from 'react-vertical-timeline-component';
import 'react-vertical-timeline-component/style.min.css';
import { TbApi } from "react-icons/tb";
import { DiAndroid } from "react-icons/di";
import "./styles/UserJourney.style.css";
import { IoTimer } from "react-icons/io5";
import { FaFilter } from "react-icons/fa6";
import Select from 'react-select';

Modal.setAppElement('#root');

const USER_JOURNEY_API_BASE =
  import.meta.env?.VITE_CDP_USER_JOURNEY_API ?? "";

function UserJourney({ userData: initialUserData = [] }) {
  const arrowStyling = {
    "borderRight": '12px solid  rgba(255, 255, 255, 0.2)'
  }

    const customStyles = {
        placeholder: (provided, state) => ({
            ...provided,
            display: "flex",
            alignItems:"center",
            gap:"8px"
        })
        // control: styles => ({ ...styles, backgroundColor: 'white' }),
        // option: (styles, { isDisabled }) => {
        //     return {
        //         ...styles,
        //         backgroundColor: isDisabled ? 'red' : 'white',
        //         color: 'black',
        //         cursor: isDisabled ? 'not-allowed' : 'default',
        //     };
        // },
    };
    const formatDate = (timestamp) => {
        if (typeof timestamp === 'string') {
            timestamp = parseInt(timestamp, 10);
        }

        if (isNaN(timestamp)) {
            return 'Invalid Date';
        }

        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }

        return date.toLocaleString();
    };

    const [visibleParams, setVisibleParams] = useState({});
    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [modalContent, setModalContent] = useState('');
    const [selectedSrc, setSelectedSrc] = useState([]);
    const [selectedEventName, setSelectedEventName] = useState([]);
    const [selectedDataSrc, setSelectedDataSrc] = useState([]);
    const [userData, setUserData] = useState([]);
    const [userKey, setUserKey] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    useEffect(() => {
        if (!initialUserData || initialUserData.length === 0) return;
        const sortedData = [...initialUserData].sort((a, b) => parseInt(a.event.ct[0].value) - parseInt(b.event.ct[0].value));
        setUserData(sortedData);
    }, [initialUserData]);

    const fetchUserJourney = async () => {
        if (!userKey || !startDate || !endDate) {
            setFetchError("Please provide user ID and date range.");
            return;
        }
        setIsLoading(true);
        setFetchError(null);
        try {
            const startEpoch = new Date(startDate).getTime();
            const endEpoch = new Date(endDate).getTime();
            const params = new URLSearchParams({
                userKey,
                startDate: startEpoch.toString(),
                endDate: endEpoch.toString()
            });
            const idToken =
                document.cookie
                    .split("; ")
                    .find((row) => row.startsWith("datanaut_id_token="))
                    ?.split("=")[1] ?? "";
                    
            const response = await fetch(`${USER_JOURNEY_API_BASE}/api/users?${params.toString()}`, {
                headers: idToken ? { Authorization: `Bearer ${idToken}` } : {}
            });
            console.log(response)
            if (!response.ok) {
                throw new Error(`Failed to load user journey (${response.status})`);
            }
            const payload = await response.json();
            const events = Array.isArray(payload?.events) ? payload.events : Array.isArray(payload) ? payload : [];
            const sorted = [...events].sort((a, b) => parseInt(a.event.ct[0].value) - parseInt(b.event.ct[0].value));
            setUserData(sorted);
        } catch (error) {
            console.error("Failed to fetch user journey", error);
            setFetchError(error.message || "Unexpected error while loading journey.");
            setUserData([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleIconClick = (index, eventParams, src, user = null) => {
        setVisibleParams((prevState) => ({
            ...prevState,
            [index]: !prevState[index]
        }));

        console.log("events_params: ", eventParams);
        let correctedParams = eventParams;
        let parsingError = false;

        try {
            console.log("SRC: ", src);
            if (src === "OTHER") {
                // Replace single quotes with double quotes
                correctedParams = correctedParams.replace(/'/g, '"');

                // Ensure all keys are quoted properly
                correctedParams = correctedParams.replace(/(\w+)=/g, '"$1":');

                // Ensure all values are quoted properly, while handling colons within timestamps and strings
                correctedParams = correctedParams.replace(/:\s*([^",{}\[\]\s]+)/g, ':"$1"');

                // Handle special characters like ₹ by escaping them properly
                correctedParams = correctedParams.replace(/₹/g, '\\u20B9');

                // Ensure colons within quoted strings are not incorrectly replaced
                correctedParams = correctedParams.replace(/"(\d{4}-\d{2}-\d{2}T\d{2}):(\d{2}):(\d+\.\d+Z)"/g, '"$1\\u003A$2\\u003A$3"');
                correctedParams = correctedParams.replace(/"(\d{2}):(\d{2}):(\d{2})"/g, '"$1\\u003A$2\\u003A$3"');

                // Add detailed logging to debug the JSON structure
                console.log('Corrected Params Before Parsing:', correctedParams);

                // Try parsing to check if it's valid JSON
                JSON.parse(correctedParams);
                console.log("src: app", correctedParams);
            } else {
                // Handle the API source case
                correctedParams = correctedParams.replace(/'/g, '"'); // Replace single quotes with double quotes
                console.log("src: api", typeof correctedParams);
                let paramsObj = JSON.parse(correctedParams); // Parse the corrected string to an object
                console.log("paramsObj: ", paramsObj);
                console.log("paramsObj: ", typeof paramsObj);
                let formattedParams = Object.keys(paramsObj).map(key => {
                    let value = paramsObj[key];
                    if (typeof value === 'number') {
                        return { "key": key, "value": { "int_value": value.toString() } };
                    } else if (typeof value === 'string') {
                        return { "key": key, "value": { "string_value": value } };
                    } else if (typeof value === 'object' && value !== null) {
                        return { "key": key, "value": { "string_value": JSON.stringify(value) } };
                    } else {
                        return { "key": key, "value": { "string_value": value ? value.toString() : "NULL" } };
                    }
                });
                console.log("src: api", formattedParams);
                correctedParams = JSON.stringify(formattedParams);
            }
        } catch (e) {
            console.error('Failed to parse correctedParams:', correctedParams);
            parsingError = true;
        }

        if (parsingError) {
            console.log("parsingError: ", correctedParams);
            setModalContent(correctedParams);
        } else if (user) {
            setModalContent(JSON.stringify({ eventParams: JSON.parse(correctedParams), user }));
        } else {
            setModalContent(correctedParams);
        }
        setModalIsOpen(true);
    };


    const closeModal = () => {
        setModalIsOpen(false);
    };

    const isValidJson = (str) => {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    };

    const renderTableContent = () => {
        console.log("renderTableContent: ", modalContent);
        if (!isValidJson(modalContent)) {
            return <p>{modalContent}</p>;
        }

        const parsedContent = JSON.parse(modalContent);

        if (parsedContent.eventParams && parsedContent.user) {
            const { eventParams, user } = parsedContent;

            return (
                <>
                    <h3 className='modalHeading'>Event Parameters</h3>
                    {renderJsonTable(eventParams)}
                    <h3 className='modalHeading'>User Data</h3>
                    {renderJsonTable(user)}
                </>
            );
        }

        return renderJsonTable(parsedContent);
    };

    const renderJsonTable = (jsonContent) => {
        const parsedContent = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;

        return (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th style={{ border: '1px solid white', padding: '8px' }}>Key</th>
                        <th style={{ border: '1px solid white', padding: '8px' }}>Value</th>
                    </tr>
                </thead>
                <tbody>
                    {Array.isArray(parsedContent) ? (
                        parsedContent.map((item, index) => (
                            <tr key={index}>
                                <td style={{ border: '1px solid white', padding: '8px' }}>{item.key}</td>
                                <td style={{ border: '1px solid white', padding: '8px' }}>
                                    {item.value.int_value !== undefined && item.value.int_value !== "null" ? item.value.int_value :
                                        item.value.string_value !== "null" ? item.value.string_value :
                                            item.value.float_value !== "null" ? item.value.float_value :
                                                item.value.double_value !== "null" ? item.value.double_value :
                                                    "NULL"}
                                </td>
                            </tr>
                        ))
                    ) : (
                        Object.entries(parsedContent).map(([key, value], index) => (
                            <tr key={index}>
                                <td style={{ border: '1px solid white', padding: '8px' }}>{key}</td>
                                <td style={{ border: '1px solid white', padding: '8px' }}>
                                    {typeof value === 'object' ? value[0].value : value}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        );
    };


    const handleSrcChange = (selectedOptions) => {
        setSelectedSrc(selectedOptions);
        setSelectedEventName([]);
        setSelectedDataSrc([]);
    };

    const handleEventNameChange = (selectedOptions) => {
        setSelectedEventName(selectedOptions);
    };

    const handleDataSrcChange = (selectedOptions) => {
        setSelectedDataSrc(selectedOptions);
    };

    const filteredData = userData.filter(item =>
        (selectedSrc.length === 0 || selectedSrc.some(src => src.value === item.cdd.src[0].value)) &&
        (selectedEventName.length === 0 || selectedEventName.some(event => event.value === item.event.event_name[0].value)) &&
        (selectedDataSrc.length === 0 || (item.cdd.src[0].value === "API" && selectedDataSrc.some(dataSrc => dataSrc.value === item.event.data_src[0].value)))
    );

    const uniqueSources = Array.from(new Set(userData.map(item => item.cdd.src[0].value)))
        .map(src => ({ value: src, label: src }));

    // Dynamic event names based on selected source
    const filteredOptionsForEventNames = userData.filter(item => selectedSrc.some(src => src.value === item.cdd.src[0].value));
    const uniqueEventNames = Array.from(new Set(filteredOptionsForEventNames.map(item => item.event.event_name[0].value)))
        .map(eventName => ({ value: eventName, label: eventName }));

    const uniqueDataSources = selectedSrc.some(src => src.value === "API") ?
        Array.from(new Set(userData.filter(item => item.cdd.src[0].value === "API").map(item => item.event.data_src[0].value)))
            .map(dataSrc => ({ value: dataSrc, label: dataSrc })) : [];


    return (
        <>
            <section className="user-journey">
                <header className="user-journey__hero">
                    <div>
                        <p>User Journey</p>
                        {/* <h1>Reconstruct a customer’s trail</h1> */}
                        {/* <p>Drop a user key and watch every app + API signal cascade across the mission log.</p> */}
                    </div>
                    <div className="user-journey__live-status">
                        <span>Telemetry linked</span>
                        <strong>{userData.length || 0} events</strong>
                    </div>
                </header>
                <form
                    className="user-journey__search"
                    onSubmit={(event) => {
                        event.preventDefault();
                        fetchUserJourney();
                    }}
                >
                    <div>
                        <label htmlFor="user-key-input">User ID</label>
                        <input
                            id="user-key-input"
                            type="text"
                            value={userKey}
                            onChange={(event) => setUserKey(event.target.value)}
                            placeholder="Enter user key"
                        />
                    </div>
                    <div>
                        <label htmlFor="start-date-input">Start date</label>
                        <input
                            id="start-date-input"
                            type="datetime-local"
                            value={startDate}
                            onChange={(event) => setStartDate(event.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="end-date-input">End date</label>
                        <input
                            id="end-date-input"
                            type="datetime-local"
                            value={endDate}
                            onChange={(event) => setEndDate(event.target.value)}
                        />
                    </div>
                    <button type="submit" disabled={isLoading}>
                        {isLoading ? "Scanning..." : "Load journey"}
                    </button>
                </form>
                {fetchError && <p className="user-journey__error">{fetchError}</p>}
                <div className="user-journey__filters">
                    <label htmlFor="data-src-filter">
                        <FaFilter /> Filter stream
                    </label>
                    <Select
                        id="src-filter"
                        value={selectedSrc}
                        onChange={handleSrcChange}
                        options={uniqueSources}
                        styles={customStyles}
                        isMulti
                        className="custom-select"
                        placeholder={<><FaFilter /> Source filter</>}
                    />
                    <Select
                        id="event-name-filter"
                        value={selectedEventName}
                        onChange={handleEventNameChange}
                        options={uniqueEventNames}
                        styles={customStyles}
                        isMulti
                        className="custom-select"
                        placeholder={<><FaFilter /> Event name</>}
                    />
                    {selectedSrc.some(src => src.value === "API") && (
                        <Select
                            id="data-src-filter"
                            value={selectedDataSrc}
                            onChange={handleDataSrcChange}
                            options={uniqueDataSources}
                            styles={customStyles}
                            isMulti
                            className="custom-select"
                            placeholder={<><FaFilter /> API Data source</>}
                        />
                    )}
                </div>
                <div className="user-journey__timeline">
                    {filteredData.length === 0 && !isLoading && (
                        <p className="user-journey__empty">Load a user journey to visualize the timeline.</p>
                    )}
                    <VerticalTimeline lineColor='rgba(148, 163, 184, 0.25)' className='timeline'>
                        {filteredData.length > 0 && filteredData
                            .slice()
                            .sort((a, b) => parseInt(a.event.ct[0].value) - parseInt(b.event.ct[0].value))
                            .map((item, index) => {
                                const prevItem = filteredData[index - 1];
                                const latency = prevItem ? (parseInt(item.event.ct[0].value) - parseInt(prevItem.event.ct[0].value)) : 0;
                                const onClickHandler = () => handleIconClick(index, item.event.event_params[0].value, item.cdd.src[0].value, item.user);

                                return (
                                    <VerticalTimelineElement
                                        className="vertical-timeline-element--work"
                                        date={formatDate(item.event.ct[0].value)}
                                        dateClassName="dateClass"
                                        iconStyle={{ background: '#10182b', color: '#fff', cursor: 'pointer' }}
                                        key={index}
                                        position={item.cdd.src[0].value === "API" ? "right" : "left"}
                                        contentArrowStyle={arrowStyling}
                                        contentStyle={{
                                            background: "rgba(5, 9, 20, 0.85)",
                                            boxShadow: "0 12px 32px rgba(2, 6, 23, 0.6)",
                                            borderRadius: "14px",
                                            border: "1px solid rgba(148, 163, 184, 0.35)",
                                            color: "white",
                                            cursor: "pointer",
                                            padding: "1rem"
                                        }}
                                        icon={item.cdd.src[0].value === "API" ? <TbApi onClick={onClickHandler} /> : <DiAndroid onClick={onClickHandler} />}
                                    >
                                        <div className='timeLineContent' onClick={onClickHandler}>
                                            <p className={`latency_${item.cdd.src[0].value === "API" ? "API" : "APP"}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", marginTop: 0, color: latency > 10000 ? "tomato" : "#14ca98" }}>
                                                <IoTimer /> {latency}ms
                                            </p>
                                            <h4 className="vertical-timeline-element-subtitle">{item.event.event_name[0].value}</h4>
                                        </div>
                                    </VerticalTimelineElement>
                                );
                            })}
                    </VerticalTimeline>
                </div>
            </section>
            <Modal
                isOpen={modalIsOpen}
                onRequestClose={closeModal}
                contentLabel="Event Parameters"
                style={{
                    content: {
                        "background": "rgba(255, 255, 255, 0.08)",
                        "boxShadow": "0 8px 32px 0 #1f2937",
                        "backdropFilter": "blur( 10.5px )",
                        "WebkitBackdropFilter": "blur( 10.5px )",
                        "borderRadius": "10px",
                        "border": "1px solid rgba( 255, 255, 255, 0.18 )",
                        "fontWeight": "600",
                        "color": "white",
                        padding: '20px',
                        maxWidth: '50rem',
                        maxHeight: 'auto',
                        margin: 'auto',
                        overflowY: 'auto'
                    },
                    overlay: {
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    },
                }}
            >
                <div style={{ fontWeight: 300 }}>
                    {renderTableContent()}
                </div>
            </Modal>
        </>
    );
}

export default UserJourney;
